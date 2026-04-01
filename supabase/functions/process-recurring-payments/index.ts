import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";


function getNextDate(current: string, frequency: string, paymentDay?: number | null): string {
  const d = new Date(current + "T12:00:00Z");
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "bimonthly": d.setMonth(d.getMonth() + 2); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "annual": d.setFullYear(d.getFullYear() + 1); break;
  }
  // Adjust to payment_day if set
  if (paymentDay && paymentDay >= 1 && paymentDay <= 31) {
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(paymentDay, maxDay));
  }
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow invocation via cron secret header OR via standard Authorization (for pg_cron + pg_net)
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  const validCron = expectedSecret && cronSecret === expectedSecret;
  const validAuth = anonKey && authHeader === `Bearer ${anonKey}`;

  if (!validCron && !validAuth) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date().toISOString().split("T")[0];

  const { data: payments, error } = await supabase
    .from("recurring_payments")
    .select("*")
    .eq("status", "active")
    .eq("requires_manual_action", false)
    .lte("next_execution_date", today);

  if (error) {
    console.error("Error querying recurring payments:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  const errors: string[] = [];

  for (const p of payments || []) {
    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: p.user_id,
      account_id: p.account_id,
      category_id: p.category_id,
      type: p.type,
      amount: p.amount,
      currency: p.currency,
      exchange_rate: 1,
      amount_in_base: p.amount,
      description: p.description || p.name,
      transaction_date: p.next_execution_date,
      is_recurring: true,
      recurring_payment_id: p.id,
    });

    if (txErr) {
      errors.push(`${p.id}: ${txErr.message}`);
      continue;
    }

    const nextDate = getNextDate(p.next_execution_date, p.frequency, p.payment_day);
    const newPaymentsMade = (p.payments_made || 0) + 1;
    const newRemaining = p.remaining_balance != null
      ? Math.max(0, p.remaining_balance - p.amount)
      : null;

    let newStatus = "active";
    if (p.total_payments && newPaymentsMade >= p.total_payments) newStatus = "completed";
    if (p.end_date && nextDate > p.end_date) newStatus = "completed";
    if (newRemaining != null && newRemaining <= 0) newStatus = "completed";

    await supabase
      .from("recurring_payments")
      .update({
        next_execution_date: nextDate,
        payments_made: newPaymentsMade,
        remaining_balance: newRemaining,
        status: newStatus,
      })
      .eq("id", p.id);

    processed++;
  }

  return new Response(JSON.stringify({ processed, errors }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
