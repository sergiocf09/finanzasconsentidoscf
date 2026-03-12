import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  webpush.setVapidDetails(
    "mailto:hola@finanzasconsentido.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const isFirstDayOfMonth = now.getDate() === 1;
  const results = { sent: 0, skipped: 0, errors: 0 };

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, push_subscription, last_active_at")
    .eq("push_enabled", true)
    .not("push_subscription", "is", null);

  if (!profiles?.length) {
    return new Response(JSON.stringify({ ...results, message: "No subscribers" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const profile of profiles) {
    const userId = profile.id;
    const sub = profile.push_subscription;

    // REGLA 1: Presupuesto al límite
    const { data: budgets } = await supabase
      .from("budgets")
      .select("id, name, amount, spent, alert_threshold, alert_sent")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("year", currentYear)
      .eq("month", currentMonth);

    for (const b of budgets ?? []) {
      if (!b.amount || b.alert_sent) continue;
      const ratio = (b.spent ?? 0) / b.amount;
      const threshold = b.alert_threshold ?? 0.8;
      if (ratio < threshold) continue;

      const pct = Math.round(ratio * 100);
      const payload = {
        title: pct >= 100 ? `⚠️ ${b.name} excedido` : `⚡ ${b.name} al ${pct}%`,
        body: pct >= 100
          ? `Ya superaste el presupuesto de ${b.name}. Revisa tus gastos.`
          : `Llevas el ${pct}% del presupuesto de ${b.name}. Cuidado con el ritmo.`,
        tag: `budget-${b.id}`,
        url: "/budgets",
      };

      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        await supabase.from("budgets").update({ alert_sent: true }).eq("id", b.id);
        await supabase.from("push_logs").insert({ user_id: userId, type: "budget_alert", payload });
        results.sent++;
      } catch {
        results.errors++;
      }
    }

    // REGLA 2: Inactividad — 3+ días sin registrar
    if (profile.last_active_at) {
      const daysSinceActive = (now.getTime() - new Date(profile.last_active_at).getTime()) / 86400000;
      if (daysSinceActive >= 3) {
        const today = now.toISOString().split("T")[0];
        const { data: recentLog } = await supabase
          .from("push_logs")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "inactivity")
          .gte("sent_at", today)
          .limit(1);

        if (!recentLog?.length) {
          const payload = {
            title: "¿Cómo va tu dinero?",
            body: `Llevas ${Math.floor(daysSinceActive)} días sin registrar. Un momento es suficiente para estar al día.`,
            tag: "inactivity",
            url: "/transactions",
          };
          try {
            await webpush.sendNotification(sub, JSON.stringify(payload));
            await supabase.from("push_logs").insert({ user_id: userId, type: "inactivity", payload });
            results.sent++;
          } catch {
            results.errors++;
          }
        } else {
          results.skipped++;
        }
      }
    }

    // REGLA 3: Resumen de cierre — solo el día 1
    if (isFirstDayOfMonth) {
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const { data: alreadySent } = await supabase
        .from("push_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "month_summary")
        .gte("sent_at", new Date(currentYear, currentMonth - 1, 1).toISOString())
        .limit(1);

      if (!alreadySent?.length) {
        const { data: txs } = await supabase
          .from("transactions")
          .select("type, amount_in_base, amount")
          .eq("user_id", userId)
          .gte("transaction_date", `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`)
          .lt("transaction_date", `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`);

        const income = (txs ?? [])
          .filter((t: any) => t.type === "income")
          .reduce((s: number, t: any) => s + (t.amount_in_base ?? t.amount), 0);
        const expense = (txs ?? [])
          .filter((t: any) => t.type === "expense")
          .reduce((s: number, t: any) => s + (t.amount_in_base ?? t.amount), 0);
        const balance = income - expense;
        const fmt = (n: number) =>
          new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
          }).format(n);

        const payload = {
          title: balance >= 0 ? "✅ Cerraste el mes en positivo" : "📊 Resumen de tu mes",
          body: `Ingresos ${fmt(income)} · Gastos ${fmt(expense)} · Balance ${fmt(balance)}`,
          tag: "month-summary",
          url: "/financial-dashboard",
        };
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          await supabase.from("push_logs").insert({ user_id: userId, type: "month_summary", payload });
          results.sent++;
        } catch {
          results.errors++;
        }
      } else {
        results.skipped++;
      }
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
