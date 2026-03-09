import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Fetch all rates from USD base
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    
    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }

    const data = await response.json();
    const mxnRate = data.rates?.MXN;

    if (!mxnRate) {
      throw new Error('MXN rate not found in response');
    }

    // Build rates object: each currency → MXN
    const rates: Record<string, number> = {};
    
    // USD → MXN directly
    rates['USD'] = mxnRate;

    // For EUR and GBP, compute cross rate through USD
    // API gives us: 1 USD = X EUR, 1 USD = Y MXN
    // We want: 1 EUR = ? MXN → (1/EUR_per_USD) * MXN_per_USD
    for (const currency of SUPPORTED_CURRENCIES) {
      if (currency === 'USD') continue;
      const currencyPerUsd = data.rates?.[currency];
      if (currencyPerUsd && currencyPerUsd > 0) {
        rates[currency] = mxnRate / currencyPerUsd;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rate: mxnRate, // backward compat: USD/MXN
        rates, // all currency → MXN rates
        date: data.time_last_update_utc || new Date().toISOString(),
        source: 'Tipo de cambio referencia',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch rate';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
