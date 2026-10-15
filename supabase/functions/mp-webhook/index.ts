
import { createClient } from "npm:@supabase/supabase-js@2";

const responder = (mensaje: string, status = 200) =>
  new Response(mensaje, { status });

function claveServidor(): string {
  const antigua = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (antigua) return antigua;

  const claves = JSON.parse(
    Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"
  );
  return claves.default || "";
}

async function verificarFirma(
  req: Request,
  paymentId: string,
  secreto: string
): Promise<boolean> {
  const firma = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";

  const valores = Object.fromEntries(
    firma.split(",")
      .map(x => x.trim().split("="))
      .filter(x => x.length === 2)
  );

  const ts = valores.ts;
  const v1 = valores.v1;

  if (!ts || !requestId || !/^[0-9a-f]{64}$/i.test(v1 || "")) {
    return false;
  }

  const fechaFirma = Number(ts) < 1e12
    ? Number(ts) * 1000
    : Number(ts);

  if (
    !Number.isFinite(fechaFirma) ||
    Math.abs(Date.now() - fechaFirma) > 72 * 60 * 60 * 1000
  ) {
    return false;
  }

  const mensaje =
    `id:${paymentId.toLowerCase()};` +
    `request-id:${requestId};` +
    `ts:${ts};`;

  const llave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const bytes = new Uint8Array(
    (v1.match(/.{2}/g) || []).map(x => parseInt(x, 16))
  );

  return crypto.subtle.verify(
    "HMAC",
    llave,
    bytes,
    new TextEncoder().encode(mensaje)
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return responder("Metodo no permitido", 405);
  }

  try {
    const secretoFirma = Deno.env.get(
      "MERCADOPAGO_WEBHOOK_SECRET"
    );
    const tokenMP = Deno.env.get(
      "MERCADOPAGO_ACCESS_TOKEN"
    );
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = claveServidor();

    if (!secretoFirma || !tokenMP || !url || !serviceKey) {
      console.error("Faltan secretos del servidor");
      return responder("Configuracion pendiente", 503);
    }

    const body = await req.json().catch(() => ({}));
    const parametros = new URL(req.url).searchParams;

    const tipo = parametros.get("type") || body?.type;
    if (tipo && tipo !== "payment") {
      return responder("Evento ignorado");
    }

    const paymentId = String(
      parametros.get("data.id") ||
      parametros.get("id") ||
      body?.data?.id ||
      ""
    );

    if (!/^\d{1,30}$/.test(paymentId)) {
      return responder("Evento ignorado");
    }

    const firmaValida = await verificarFirma(
      req,
      paymentId,
      secretoFirma
    );

    if (!firmaValida) {
      console.error("Firma de Mercado Pago invalida");
      return responder("Firma invalida", 401);
    }

    // Consultar el estado real directamente con Mercado Pago.
    const respuestaMP = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${tokenMP}`
        }
      }
    );

    if (!respuestaMP.ok) {
      console.error("Error consultando Mercado Pago", respuestaMP.status);
      return responder("No se pudo verificar el pago", 503);
    }

    const pago = await respuestaMP.json();

    const ordenId = String(pago.external_reference || "");

    if (
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
        ordenId
      )
    ) {
      return responder("Orden desconocida");
    }

    const supabase = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: orden, error: errorOrden } = await supabase
      .from("mp_orders")
      .select("*")
      .eq("id", ordenId)
      .maybeSingle();

    if (errorOrden) {
      console.error("Error consultando orden", errorOrden.message);
      return responder("Error consultando orden", 503);
    }

    if (!orden) {
      return responder("Orden no encontrada");
    }

    // Comprobar importe, moneda y preferencia de pago.
    const importeCorrecto =
      Number.isFinite(Number(pago.transaction_amount)) &&
      Math.round(Number(pago.transaction_amount) * 100) ===
        Math.round(Number(orden.amount) * 100);

    const preferenciaCorrecta =
      !orden.mp_preference_id ||
      !pago.preference_id ||
      String(orden.mp_preference_id) ===
        String(pago.preference_id);

    if (
      pago.currency_id !== "MXN" ||
      !importeCorrecto ||
      !preferenciaCorrecta
    ) {
      console.error("El pago no coincide con la orden", orden.id);

      if (orden.status === "pending") {
        await supabase.from("mp_orders")
          .update({
            status: "review",
            mp_payment_id: paymentId
          })
          .eq("id", orden.id)
          .eq("status", "pending");
      }

      return responder("Pago enviado a revision");
    }

    if (pago.status === "approved") {
      // La función SQL realizará ambas operaciones
      // en una única transacción:
      // 1. Confirmar la cita.
      // 2. Vincular el pago aprobado con la cita.
      const { data: resultado, error: errorConfirmacion } =
        await supabase.rpc("lt_confirmar_pago_mp", {
          p_order_id: orden.id,
          p_payment_id: paymentId
        });

      if (errorConfirmacion) {
        console.error(
          "Error confirmando pago y cita",
          errorConfirmacion.code,
          errorConfirmacion.message
        );

        return responder("Confirmacion pendiente", 503);
      }

      console.info("Resultado de confirmacion:", resultado?.estado);
      return responder("Notificacion procesada");
    }

    if (
      ["rejected", "cancelled", "refunded", "charged_back"]
        .includes(String(pago.status))
    ) {
      if (orden.status === "pending") {
        const estado = pago.status === "refunded"
          ? "refunded"
          : "rejected";

        const { error } = await supabase
          .from("mp_orders")
          .update({
            status: estado,
            mp_payment_id: paymentId
          })
          .eq("id", orden.id)
          .eq("status", "pending");

        if (error) {
          console.error(error.message);
          return responder("Actualizacion pendiente", 503);
        }
      } else if (orden.status === "approved") {
        console.error(
          "Pago previamente aprobado requiere revision:",
          orden.id
        );
      }
    }

    return responder("Notificacion recibida");

  } catch (error) {
    console.error("Error en mp-webhook:", error);
    return responder("Error interno", 500);
  }
});
