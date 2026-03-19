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
    // Support both single image (legacy) and multiple images
    const images: { base64: string; mediaType: string }[] = [];
    
    if (body.images && Array.isArray(body.images)) {
      // New multi-image format: { images: [{base64, mediaType}], mode }
      for (const img of body.images) {
        if (img.base64 && img.mediaType) {
          images.push({ base64: img.base64, mediaType: img.mediaType });
        }
      }
    } else if (body.imageBase64 && body.mediaType) {
      // Legacy single-image format
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

    const promptSingle = `Analiza este recibo o comprobante de pago y extrae los datos.
Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks, sin explicaciones.
Formato exacto:
{
  "mode": "single",
  "amount": número o null,
  "currency": "MXN" o "USD" o "EUR",
  "date": "YYYY-MM-DD" o null,
  "merchant": "nombre del establecimiento" o null,
  "category_hint": uno de: "restaurante|supermercado|gasolina|farmacia|transporte|entretenimiento|ropa|servicios|salud|educacion|otro",
  "description": "descripción corta máximo 40 caracteres" o null,
  "confidence": número del 0 al 1
}
Si el campo no es legible usa null. El monto debe ser el TOTAL del recibo.`;

    const promptMultipleReceipts = `Analiza estas ${images.length} imágenes. Cada una es un recibo o comprobante de pago INDEPENDIENTE.
Extrae los datos de CADA recibo por separado.
Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks, sin explicaciones.
Formato exacto:
{
  "mode": "statement",
  "transactions": [
    {
      "amount": número,
      "currency": "MXN" o "USD",
      "date": "YYYY-MM-DD" o null,
      "merchant": "nombre del establecimiento",
      "type": "expense",
      "category_hint": uno de: "restaurante|supermercado|gasolina|farmacia|transporte|entretenimiento|ropa|servicios|salud|educacion|otro",
      "description": "descripción corta máximo 40 caracteres"
    }
  ]
}
Cada imagen es un recibo diferente — genera una transacción por imagen.`;

    const promptStatement = `Analiza ${images.length > 1 ? "estas imágenes que son páginas del mismo" : "este"} estado de cuenta o lista de movimientos y extrae CADA transacción como un elemento del array.
Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks, sin explicaciones.
Formato exacto:
{
  "mode": "statement",
  "transactions": [
    {
      "amount": número,
      "currency": "MXN" o "USD",
      "date": "YYYY-MM-DD" o null,
      "merchant": "nombre o descripción del movimiento",
      "type": "expense" o "income",
      "category_hint": uno de: "restaurante|supermercado|gasolina|farmacia|transporte|entretenimiento|ropa|servicios|salud|educacion|otro",
      "description": "descripción corta máximo 40 caracteres"
    }
  ]
}
${images.length > 1 ? "Las imágenes son páginas consecutivas del MISMO documento — combina todos los movimientos en un solo array." : ""}
Incluye solo transacciones con monto claro. Ignora saldos, totales y encabezados. Máximo 30 transacciones.`;

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
