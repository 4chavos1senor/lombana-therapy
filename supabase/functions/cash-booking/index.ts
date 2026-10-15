
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responder(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fechaValida(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const d = new Date(`${fecha}T12:00:00Z`);

  return (
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === fecha
  );
}

function fechaHoraMexicoActual() {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const partes = Object.fromEntries(
    formato.formatToParts(new Date())
      .filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  );

  return (
    `${partes.year}-${partes.month}-${partes.day}` +
    `T${partes.hour}:${partes.minute}`
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return responder(
      { error: "Metodo no permitido." },
      405
    );
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceKey) {
      console.error("Configuracion Supabase incompleta");
      return responder(
        { error: "Servicio temporalmente no disponible." },
        503
      );
    }

    // Validar sesion real del usuario.
    const authorization =
      req.headers.get("Authorization") || "";

    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return responder(
        { error: "Debes iniciar sesion." },
        401
      );
    }

    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userError } =
      await admin.auth.getUser(token);

    if (userError || !userData.user) {
      return responder(
        { error: "Sesion invalida o expirada." },
        401
      );
    }

    // Leer los datos de la reservacion.
    let body: Record<string, unknown>;

    try {
      const datos = await req.json();

      if (
        !datos ||
        typeof datos !== "object" ||
        Array.isArray(datos)
      ) {
        return responder(
          { error: "Datos invalidos." },
          400
        );
      }

      body = datos;
    } catch {
      return responder(
        { error: "Solicitud JSON invalida." },
        400
      );
    }

    const therapyId = body.therapy_id;
    const fecha = body.fecha;
    const horaRecibida = body.hora_inicio;

    if (
      typeof therapyId !== "string" ||
      !UUID_REGEX.test(therapyId) ||
      typeof fecha !== "string" ||
      !fechaValida(fecha) ||
      typeof horaRecibida !== "string" ||
      !/^\d{2}:00(?::00)?$/.test(horaRecibida)
    ) {
      return responder(
        { error: "Datos de reservacion invalidos." },
        400
      );
    }

    const hora = horaRecibida.slice(0, 2);
    const horaInicio = `${hora}:00:00`;
    const numeroHora = Number(hora);

    // Comprobar horario laboral.
    const dia = new Date(
      `${fecha}T12:00:00Z`
    ).getUTCDay();

    const horaCierre = dia === 6 ? 15 : 18;

    if (
      dia === 0 ||
      numeroHora < 9 ||
      numeroHora >= horaCierre ||
      `${fecha}T${hora}:00` <= fechaHoraMexicoActual()
    ) {
      return responder(
        { error: "Fecha u horario no disponible." },
        400
      );
    }

    // Verificar terapia activa.
    const { data: terapia, error: errorTerapia } =
      await admin
        .from("therapies")
        .select("id, activo")
        .eq("id", therapyId)
        .eq("activo", true)
        .maybeSingle();

    if (errorTerapia) {
      console.error("Error comprobando terapia", errorTerapia);

      return responder(
        { error: "No se pudo verificar la terapia." },
        503
      );
    }

    if (!terapia) {
      return responder(
        { error: "Terapia no disponible." },
        400
      );
    }

    // La operacion SQL crea la cita y
    // el pago pendiente en una transaccion.
    const { data: reserva, error: errorReserva } =
      await admin.rpc("create_cash_booking", {
        p_user_id: userData.user.id,
        p_therapy_id: terapia.id,
        p_fecha: fecha,
        p_hora_inicio: horaInicio,
      });

    if (errorReserva) {
      console.error(
        "Error en create_cash_booking:",
        errorReserva.code,
        errorReserva.message
      );

      const mensaje = errorReserva.message || "";

      const conflicto =
        errorReserva.code === "23P01" ||
        errorReserva.code === "23505" ||
        /ocupado|superpon|empalm|solap/i.test(mensaje);

      if (conflicto) {
        return responder(
          {
            error:
              "Ese horario ya esta ocupado. " +
              "Selecciona otro horario.",
          },
          409
        );
      }

      if (errorReserva.code === "22023") {
        return responder(
          { error: "Datos u horario invalidos." },
          400
        );
      }

      if (errorReserva.code === "42501") {
        return responder(
          { error: "Operacion no autorizada." },
          403
        );
      }

      return responder(
        {
          error:
            "No se pudo registrar la cita. " +
            "Comprueba la configuracion de Supabase.",
        },
        500
      );
    }

    if (!reserva?.appointment_id) {
      console.error("Respuesta SQL sin appointment_id");

      return responder(
        { error: "No se pudo verificar la reserva." },
        500
      );
    }

    // No se declara ningun pago como realizado.
    return responder(
      {
        ok: true,
        appointment_id: reserva.appointment_id,
        payment_status: "pending_in_person",
        mensaje:
          "Cita confirmada. " +
          "El pago se realizara en el establecimiento.",
      },
      201
    );

  } catch (error) {
    console.error("Error en cash-booking:", error);

    return responder(
      { error: "Error interno del servidor." },
      500
    );
  }
});
