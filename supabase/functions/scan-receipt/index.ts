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

    const ALLOWED_MEDIA_TYPES = new Set([
      "image/jpeg", "image/png", "image/webp", "image/gif",
    ]);
    const MAX_IMAGE_COUNT = 10;
    const MAX_BASE64_LENGTH = 7_000_000;

    const images: { base64: string; mediaType: string }[] = [];

    if (body.images && Array.isArray(body.images)) {
      if (body.images.length > MAX_IMAGE_COUNT) {
        return new Response(
          JSON.stringify({ error: "Máximo 10 imágenes por solicitud." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      for (const img of body.images) {
        if (img.base64 && img.mediaType) {
          if (!ALLOWED_MEDIA_TYPES.has(img.mediaType)) {
            return new Response(
              JSON.stringify({ error: "Tipo de imagen no soportado." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (img.base64.length > MAX_BASE64_LENGTH) {
            return new Response(
              JSON.stringify({ error: "Imagen demasiado grande (máx ~5 MB)." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          images.push({ base64: img.base64, mediaType: img.mediaType });
        }
      }
    } else if (body.imageBase64 && body.mediaType) {
      if (!ALLOWED_MEDIA_TYPES.has(body.mediaType)) {
        return new Response(
          JSON.stringify({ error: "Tipo de imagen no soportado." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (body.imageBase64.length > MAX_BASE64_LENGTH) {
        return new Response(
          JSON.stringify({ error: "Imagen demasiado grande (máx ~5 MB)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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

    // ─── PROMPT: recibo único ─────────────────────────────────────────
    const promptSingle = `Analiza este recibo o comprobante de pago.

REGLAS:
1. MONTO: Extrae el TOTAL. Aplica esta regla para separadores:
   - Lee el número de derecha a izquierda.
   - Si los últimos 2 dígitos están separados por punto → el punto es decimal,
     la coma es miles. Ejemplo: "$1,618.63" → 1618.63
   - Si los últimos 2 dígitos están separados por coma → la coma es decimal,
     el punto es miles. Ejemplo: "$1.618,63" → 1618.63
   - Si no hay separador con exactamente 2 dígitos al final → es número entero.
     Ejemplo: "$1,618" → 1618, "$26,732" → 26732
   - Devuelve siempre el número como float con punto decimal. Nunca texto.
2. FECHA: formato YYYY-MM-DD. Conserva el año exacto del documento.
3. ESTABLECIMIENTO: nombre tal como aparece.

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

    // ─── PROMPT: múltiples recibos independientes ─────────────────────
    const promptMultipleReceipts = `Analiza estas ${images.length} imágenes. Cada una es un recibo INDEPENDIENTE.

REGLAS:
1. MONTOS — LECTURA DE SEPARADORES:
   Lee cada monto de derecha a izquierda para identificar decimales:
   - Si el último separador (. o ,) está seguido de exactamente 2 dígitos
     al final del número → ese separador es el decimal. El otro es de miles.
     Ejemplo formato MX: "$1,618.63" → 1618.63
     Ejemplo formato EU: "$1.618,63" → 1618.63
   - Si no hay separador con 2 dígitos al final → número entero.
     Ejemplo: "$26,732" → 26732   "$1,618" → 1618
   - NUNCA omitas dígitos. Devuelve siempre float con punto decimal.
2. Extrae el TOTAL de cada recibo.
3. FECHA: año exacto del documento, formato YYYY-MM-DD.
4. Un recibo = una transacción.

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

    // ─── PROMPT: estado de cuenta bancario ───────────────────────────
    const imgLabel = images.length > 1
      ? "estas imágenes que son páginas del mismo"
      : "este";

    const multiPageNote = images.length > 1
      ? "Las imágenes son páginas del MISMO estado. Combina TODOS los movimientos en un array ordenado por fecha ascendente."
      : "";

    const promptStatement = `Analiza ${imgLabel} estado de cuenta bancario mexicano. Extrae CADA transacción.

REGLA 1 — FECHAS (CRÍTICO):
- El año que aparece en el documento ES el año correcto. No lo cambies.
- "09-mar-2026" = 2026-03-09. "06-abr-2026" = 2026-04-06.
- NUNCA uses 2020. Si el documento dice 2026, todas las fechas son 2026.
- Meses: ene=01 feb=02 mar=03 abr=04 may=05 jun=06 jul=07 ago=08 sep=09 oct=10 nov=11 dic=12
- Si un renglón no muestra año, usa el año del encabezado del estado.
- Formato de salida obligatorio: YYYY-MM-DD

REGLA 2 — MONTOS (LECTURA DE SEPARADORES):
Lee cada monto de derecha a izquierda para identificar decimales:
- Si el último separador (. o ,) está seguido de exactamente 2 dígitos
  al final del número → ese separador es el decimal.
  El otro separador es de miles y se ignora.
  Ejemplo formato MX:  "$1,618.63"  → 1618.63
  Ejemplo formato EU:  "$1.618,63"  → 1618.63
- Si no hay separador con 2 dígitos al final → número entero sin decimales.
  Ejemplo: "$26,732" → 26732   "$1,618" → 1618
- El signo $ puede estar o no. Extrae solo el número.
- NUNCA omitas dígitos del número entero. "$8,661.00" → 8661.
- Devuelve siempre float con punto decimal como separador. Nunca texto.
- Siempre número positivo en el JSON.

REGLA 3 — TIPO:
- "expense": cargos y compras (signo + en columna Monto de Scotiabank).
- "income": pagos y abonos. Descripciones: "PAGO EN LINEA", "SU PAGO EN LINEA GRACIAS",
  "ABONO", "DEVOLUCION" (signo - en columna Monto de Scotiabank).

REGLA 4 — QUÉ INCLUIR:
- Transacciones de TODAS las tarjetas: titular Y adicionales.
- Si hay secciones "Tarjeta titular XXXX" y "Tarjeta adicional XXXX", extrae ambas.
- Solo renglones con fecha Y monto legibles.
- Hasta 100 transacciones.

REGLA 5 — QUÉ IGNORAR:
- "Total cargos", "Total abonos", saldos, límites de crédito.
- Encabezados: "Fecha de cargo", "Descripción del movimiento", "Monto".
- Publicidad: "Scotia Rewards", "ScotiaMóvil", avisos legales, números de página.

REGLA 6 — DESCRIPCIONES:
- Copia el nombre exactamente como aparece. Máximo 60 caracteres.

${multiPageNote}

Responde ÚNICAMENTE con JSON válido. Sin texto. Sin backticks:
{
  "mode": "statement",
  "transactions": [
    {
      "amount": número positivo,
      "currency": "MXN",
      "date": "YYYY-MM-DD",
      "merchant": "nombre exacto",
      "type": "expense" o "income",
      "category_hint": "restaurante" o "supermercado" o "gasolina" o "farmacia" o "transporte" o "entretenimiento" o "ropa" o "servicios" o "salud" o "educacion" o "transferencia" o "seguro" o "otro",
      "description": "descripción máximo 60 caracteres"
    }
  ]
}`;

    // ─── Selección de prompt ──────────────────────────────────────────
    let prompt: string;
    if (mode === "statement") {
      prompt = promptStatement;
    } else if (images.length > 1) {
      prompt = promptMultipleReceipts;
    } else {
      prompt = promptSingle;
    }

    // ─── Llamada a Gemini con temperature 0 ──────────────────────────
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
          temperature: 0,
          messages: [{ role: "user", content: contentParts }],
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
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiResultText = await response.text();
    let aiResult: any = {};
    try {
      aiResult = aiResultText ? JSON.parse(aiResultText) : {};
    } catch (e) {
      console.error("scan-receipt: AI gateway returned non-JSON:", aiResultText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No se pudo leer la imagen. Intenta con mejor iluminación." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawText = aiResult.choices?.[0]?.message?.content ?? "";
    const clean = String(rawText).replace(/```json|```/g, "").trim();

    if (!clean) {
      console.error("scan-receipt: empty content from AI", JSON.stringify(aiResult).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No se pudo leer la imagen. Intenta con mejor iluminación." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract first JSON object/array even if model added extra text
    let jsonStr = clean;
    const firstBrace = clean.search(/[\[{]/);
    if (firstBrace > 0) jsonStr = clean.slice(firstBrace);
    const lastBrace = Math.max(jsonStr.lastIndexOf("}"), jsonStr.lastIndexOf("]"));
    if (lastBrace > 0) jsonStr = jsonStr.slice(0, lastBrace + 1);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("scan-receipt: could not parse model JSON:", clean.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No se pudo leer la imagen. Intenta con mejor iluminación." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("scan-receipt error:", err?.message || err);
    return new Response(
      JSON.stringify({ error: "No se pudo leer la imagen. Intenta con mejor iluminación." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
