import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const MAX_IMAGE_COUNT = 10;
    const MAX_BASE64_LENGTH = 7_000_000; // ~5 MB per image

    // Support both single image (legacy) and multiple images
    const images: { base64: string; mediaType: string }[] = [];
    
    if (body.images && Array.isArray(body.images)) {
      if (body.images.length > MAX_IMAGE_COUNT) {
        return new Response(JSON.stringify({ error: "Máximo 10 imágenes por solicitud." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const img of body.images) {
        if (img.base64 && img.mediaType) {
          if (!ALLOWED_MEDIA_TYPES.has(img.mediaType)) {
            return new Response(JSON.stringify({ error: "Tipo de imagen no soportado." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (img.base64.length > MAX_BASE64_LENGTH) {
            return new Response(JSON.stringify({ error: "Imagen demasiado grande (máx ~5 MB)." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          images.push({ base64: img.base64, mediaType: img.mediaType });
        }
      }
    } else if (body.imageBase64 && body.mediaType) {
      if (!ALLOWED_MEDIA_TYPES.has(body.mediaType)) {
        return new Response(JSON.stringify({ error: "Tipo de imagen no soportado." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (body.imageBase64.length > MAX_BASE64_LENGTH) {
        return new Response(JSON.stringify({ error: "Imagen demasiado grande (máx ~5 MB)." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      images.push({ base64: body.imageBase64, mediaType: body.mediaType });
    }

    const mode = body.mode || "single";

    if (images.length === 0) {
      return new Response(JSON.stringify({ error: "Missing image data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const promptSingle = `Analiza este recibo o comprobante de pago.

REGLAS CRÍTICAS:
1. MONTO: El símbolo $ va pegado al número sin espacio. "$947.60" = 947.60. NUNCA omitas el primer dígito después del $. Extrae el TOTAL del recibo.
2. FECHA: La fecha de emisión del recibo en formato YYYY-MM-DD.
3. ESTABLECIMIENTO: El nombre del negocio tal como aparece.

Responde ÚNICAMENTE con JSON válido sin backticks:
{
  "mode": "single",
  "amount": número o null,
  "currency": "MXN",
  "date": "YYYY-MM-DD o null",
  "merchant": "nombre del establecimiento",
  "category_hint": "restaurante" o "supermercado" o "gasolina" o "farmacia" o "transporte" o "entretenimiento" o "ropa" o "servicios" o "salud" o "educacion" o "otro",
  "description": "descripción máximo 50 caracteres"
}`;

    const promptMultipleReceipts = `Analiza estas ${images.length} imágenes. Cada una es un recibo o comprobante de pago INDEPENDIENTE.

REGLAS CRÍTICAS:
1. MONTOS: El símbolo $ va pegado al número. "$338" = 338, "$2794.98" = 2794.98. NUNCA omitas dígitos después del $.
2. Extrae el TOTAL de cada recibo, no subtotales.
3. Un recibo = una transacción en el array.

Responde ÚNICAMENTE con JSON válido sin backticks:
{
  "mode": "statement",
  "transactions": [
    {
      "amount": número positivo,
      "currency": "MXN",
      "date": "YYYY-MM-DD o null",
      "merchant": "nombre del establecimiento",
      "type": "expense",
      "category_hint": "restaurante" o "supermercado" o "gasolina" o "farmacia" o "transporte" o "entretenimiento" o "ropa" o "servicios" o "salud" o "educacion" o "otro",
      "description": "descripción máximo 50 caracteres"
    }
  ]
}`;

    const promptStatement = `Analiza ${images.length > 1 ? "estas imágenes que son páginas del mismo" : "este"} estado de cuenta bancario mexicano y extrae CADA transacción individual.

REGLAS CRÍTICAS — LEE CON ATENCIÓN:

1. FECHAS — REGLA MÁS IMPORTANTE:
   - Conserva el año EXACTO como aparece en el documento.
   - Si el estado dice "09-mar-2026", la fecha es 2026-03-09. NO es 2020, NO es 2025.
   - Si el año del documento es 2026, TODAS las fechas son 2026.
   - Formato obligatorio: YYYY-MM-DD.
   - Si una fecha dice solo día y mes sin año, usa el año del encabezado del estado de cuenta.
   - Meses en español: ene=01, feb=02, mar=03, abr=04, may=05, jun=06,
     jul=07, ago=08, sep=09, oct=10, nov=11, dic=12.

2. MONTOS:
   - El símbolo $ va pegado al número. "$947.60" = 947.60. "$1,214.65" = 1214.65.
   - NUNCA omitas dígitos. Si ves "$8661" el monto es 8661, no 661.
   - Las comas son separadores de miles, no decimales. "$26,732.88" = 26732.88.
   - El monto siempre va como número positivo en el JSON.

3. TIPO DE TRANSACCIÓN:
   - "expense": cargos, compras, consumos — columna con signo + en estados Scotiabank.
   - "income": pagos, abonos, devoluciones — descripción dice "PAGO EN LINEA", "ABONO",
     "DEVOLUCION" o tiene signo - en la columna de monto.

4. QUÉ INCLUIR:
   - Solo renglones con fecha Y monto legibles.
   - Incluye transacciones de TODAS las tarjetas del estado (titular y adicionales).
   - Si hay varias secciones (tarjeta titular, tarjeta adicional), extrae TODAS.

5. QUÉ IGNORAR:
   - Totales, subtotales, saldos anteriores, límites de crédito.
   - Encabezados de columna ("Fecha de cargo", "Descripción", "Monto").
   - Texto publicitario, logos, números de página, avisos legales.
   - IVA desglosado por separado (si ya está incluido en el cargo principal).

6. DESCRIPCIONES:
   - Copia el nombre del establecimiento exactamente como aparece.
   - Máximo 60 caracteres. No traduzcas ni abrevies.

7. LÍMITE: Incluye hasta 100 transacciones si las hay. No cortes el listado.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks, sin comentarios:
{
  "mode": "statement",
  "transactions": [
    {
      "amount": número positivo,
      "currency": "MXN",
      "date": "YYYY-MM-DD",
      "merchant": "nombre exacto del establecimiento",
      "type": "expense" o "income",
      "category_hint": "restaurante" o "supermercado" o "gasolina" o "farmacia" o "transporte" o "entretenimiento" o "ropa" o "servicios" o "salud" o "educacion" o "transferencia" o "seguro" o "otro",
      "description": "descripción máximo 60 caracteres"
    }
  ]
}
${images.length > 1 ? "Las imágenes son páginas consecutivas del MISMO estado de cuenta. Combina TODOS los movimientos de TODAS las páginas en un solo array ordenado por fecha ascendente." : ""}
Sé exhaustivo: extrae cada renglón de transacción que tenga fecha y monto. No omitas ninguna.`;

    // Choose prompt based on mode and image count
    let prompt: string;
    if (mode === "statement") {
      prompt = promptStatement;
    } else if (images.length > 1) {
      // Multiple images in single/receipt mode = independent receipts
      prompt = promptMultipleReceipts;
    } else {
      prompt = promptSingle;
    }

    // Build content array with all images + prompt
    const contentParts: any[] = [];
    for (const img of images) {
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
      });
    }
    contentParts.push({ type: "text", text: prompt });

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: contentParts,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes. Intenta en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Agrega fondos en la configuración del workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const rawText =
      aiResult.choices?.[0]?.message?.content || "{}";
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("scan-receipt error:", err.message);
    return new Response(
      JSON.stringify({
        error:
          "No se pudo leer la imagen. Intenta con mejor iluminación.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
