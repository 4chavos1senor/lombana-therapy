
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json"
    }
  });
}

function serviceKey(): string {
  const antigua = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (antigua) return antigua;

  try {
    const keys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"
    );
    return keys.default || "";
  } catch {
    return "";
  }
}

function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const d = new Date(`${fecha}T12:00:00Z`);

  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === fecha;
}

function ahoraMexico(): string {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const partes = Object.fromEntries(
    f.formatToParts(new Date())
      .filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  );

  return `${partes.year}-${partes.month}-${partes.day}` +
    `T${partes.hour}:${partes.minute}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Metodo no permitido." }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = serviceKey();
    const tokenMP = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const site = Deno.env.get("PUBLIC_SITE_URL");
    const webhook = Deno.env.get("MP_WEBHOOK_URL");

    if (!url || !key || !tokenMP || !site || !webhook) {
      console.error("Faltan variables del servidor");
      return json({
        error: "Configuracion de pagos incompleta."
      }, 503);
    }

    const authorization =
      req.headers.get("authorization") || "";

    const jwt = authorization
      .match(/^Bearer\s+(.+)$/i)?.[1];

    if (!jwt) {
      return json({ error: "Debes iniciar sesion." }, 401);
    }

    const admin = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: auth, error: authError } =
      await admin.auth.getUser(jwt);

    if (authError || !auth.user) {
      return json({
        error: "Sesion invalida o expirada."
      }, 401);
    }

    let body: Record<string, unknown>;

    try {
      body = await req.json();

      if (!body || typeof body !== "object" ||
          Array.isArray(body)) {
        return json({ error: "Datos invalidos." }, 400);
      }
    } catch {
      return json({ error: "JSON invalido." }, 400);
    }

    const therapyId = body.therapy_id;
    const fecha = body.fecha;
    const hora = body.hora_inicio;

    if (
      typeof therapyId !== "string" ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
        .test(therapyId) ||
      typeof fecha !== "string" ||
      !fechaValida(fecha) ||
      typeof hora !== "string" ||
      !/^\d{2}:00(?::00)?$/.test(hora)
    ) {
      return json({
        error: "Datos de la cita invalidos."
      }, 400);
    }

    const numeroHora = Number(hora.slice(0, 2));
    const horaSQL =
      `${hora.slice(0, 2)}:00:00`;

    const dia = new Date(
      `${fecha}T12:00:00Z`
    ).getUTCDay();

    if (
      dia === 0 ||
      numeroHora < 9 ||
      numeroHora >= (dia === 6 ? 15 : 18) ||
      `${fecha}T${hora.slice(0, 5)}` <= ahoraMexico()
    ) {
      return json({
        error: "Fecha u horario no disponible."
      }, 400);
    }

    const { data: terapia, error: errorTerapia } =
      await admin.from("therapies")
        .select("id,nombre,precio,activo")
        .eq("id", therapyId)
        .eq("activo", true)
        .maybeSingle();

    if (errorTerapia || !terapia) {
      return json({
        error: "Terapia no disponible."
      }, 400);
    }

    // La reserva temporal se crea atomicamente
    // dentro de Supabase, no desde el navegador.
    const { data: orden, error: errorOrden } =
      await admin.rpc("lt_crear_orden_mp", {
        p_user_id: auth.user.id,
        p_therapy_id: therapyId,
        p_fecha: fecha,
        p_hora_inicio: horaSQL
      });

    if (errorOrden) {
      console.error(
        "Error reservando horario:",
        errorOrden.code,
        errorOrden.message
      );

      if (
        errorOrden.code === "23P01" ||
        errorOrden.code === "23505" ||
        /ocupado|reservado|superpon/i.test(
          errorOrden.message || ""
        )
      ) {
        return json({
          error: "Ese horario ya esta ocupado."
        }, 409);
      }

      if (errorOrden.code === "22023") {
        return json({
          error: "Horario o precio invalido."
        }, 400);
      }

      return json({
        error: "No se pudo reservar temporalmente."
      }, 503);
    }

    if (!orden?.order_id || !Number(orden.amount)) {
      return json({
        error: "Respuesta de reserva incompleta."
      }, 500);
    }

    const orderId = String(orden.order_id);

    const siteUrl = new URL(
      site.endsWith("/") ? site : site + "/"
    );
    const webhookUrl = new URL(webhook);

    if (
      siteUrl.protocol !== "https:" ||
      webhookUrl.protocol !== "https:"
    ) {
      return json({
        error: "Las URL publicas deben utilizar HTTPS."
      }, 503);
    }

    const resultadoUrl = new URL(
      "pago-resultado.html",
      siteUrl
    ).href;

    // La preferencia de pago corresponde
    // a la orden reservada temporalmente.
    const preferencia = {
      items: [{
        id: String(terapia.id),
        title: String(terapia.nombre),
        quantity: 1,
        currency_id: "MXN",
        unit_price: Number(orden.amount)
      }],
      external_reference: orderId,
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to:
        new Date(Date.now() + 29 * 60_000).toISOString(),
      back_urls: {
        success: resultadoUrl,
        pending: resultadoUrl,
        failure: resultadoUrl
      },
      notification_url: webhookUrl.href,
      metadata: {
        order_id: orderId
      },
      payer: {
        email: auth.user.email
      }
    };

    const respuesta = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenMP}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": orderId
        },
        body: JSON.stringify(preferencia)
      }
    );

    const datosMP = await respuesta.json()
      .catch(() => ({}));

    if (
      !respuesta.ok ||
      typeof datosMP.init_point !== "string"
    ) {
      console.error(
        "Error creando preferencia:",
        respuesta.status,
        datosMP
      );

      return json({
        error:
          "Mercado Pago no pudo iniciar el pago. " +
          "La reserva temporal caducara automaticamente."
      }, 502);
    }

    const { error: errorGuardar } =
      await admin.from("mp_orders")
        .update({
          mp_preference_id: datosMP.id
        })
        .eq("id", orderId)
        .eq("status", "pending");

    if (errorGuardar) {
      console.error(
        "No se pudo guardar la preferencia:",
        errorGuardar.message
      );

      return json({
        error: "No se pudo completar la preparacion del pago."
      }, 503);
    }

    // Se devuelve la URL; no se confirma la cita.
    // La confirmacion se realizara mediante el webhook.
    return json({
      checkout_url: datosMP.init_point,
      order_id: orderId
    });

  } catch (error) {
    console.error("Error mp-checkout:", error);

    return json({
      error: "No se pudo iniciar el pago."
    }, 500);
  }
});
