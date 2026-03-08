const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch USD→MXN rate from free exchange rate API
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    
    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }

    const data = await response.json();
    const mxnRate = data.rates?.MXN;

    if (!mxnRate) {
      throw new Error('MXN rate not found in response');
    }

    return new Response(
      JSON.stringify({
        success: true,
        rate: mxnRate,
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
