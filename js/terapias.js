
/* =========================================
   LOMBANA THERAPY
   ARCHIVO: js/terapias.js
   CARGA DE TERAPIAS DESDE SUPABASE
========================================= */


/* =========================================
   IMÁGENES DE TERAPIAS
========================================= */

const IMAGENES_TERAPIAS = {
  "masaje-relajante": "assets/img/masaje-relajante.jpg",
  "drenaje-linfatico": "assets/img/drenaje-linfatico.jpg",
  "masaje-terapeutico": "assets/img/masaje-terapeutico.jpg",
  "quiromasaje": "assets/img/quiromasaje.jpg",
  "reflexologia": "assets/img/reflexologia.jpg",
  "ventosas": "assets/img/ventosas.jpg",
  "ajustes-quiropracticos": "assets/img/ajustes-quiropracticos.jpg",
  "aromaterapia": "assets/img/aromaterapia.jpg"
};

const IMAGEN_DEFAULT = "assets/img/terapia-default.jpg";


/* =========================================
   INICIALIZACIÓN
========================================= */

document.addEventListener("DOMContentLoaded", () => {

  // Cargar terapias en la página principal
  // o en el catálogo completo.
  if (
    document.getElementById("terapias-destacadas") ||
    document.getElementById("terapias-container")
  ) {
    cargarTerapias();
  }

  // Cargar los detalles de una terapia.
  if (document.getElementById("terapia-nombre")) {
    cargarDetalleTerapia();
  }

});


/* =========================================
   FUNCIONES AUXILIARES
========================================= */

/*
  Protege los textos que se insertan
  mediante innerHTML.
*/
function textoSeguroHTML(valor) {

  const caracteres = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(valor ?? "").replace(
    /[&<>"']/g,
    (caracter) => caracteres[caracter]
  );
}


/*
  Obtiene el identificador de la terapia.
*/
function obtenerSlug(terapia) {

  if (terapia.slug) {
    return String(terapia.slug);
  }

  return String(terapia.nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

}


/*
  Obtiene la imagen de la terapia.
  Primero busca la imagen de Supabase.
  Después utiliza una imagen local.
*/
function obtenerImagenTerapia(terapia) {

  const slug = obtenerSlug(terapia);

  return (
    terapia.imagen_url ||
    IMAGENES_TERAPIAS[slug] ||
    IMAGEN_DEFAULT
  );

}


/*
  Si una imagen falla, utiliza la imagen
  predeterminada.
*/
function imagenFallback(img) {

  img.onerror = null;

  img.alt = "Imagen de referencia de una terapia";

  const referencia = new URL(
    IMAGEN_DEFAULT,
    document.baseURI
  ).href;

  if (img.src !== referencia) {
    img.src = referencia;
  }

}


/*
  Elimina las terapias duplicadas
  utilizando su slug.
*/
function quitarDuplicadosPorSlug(terapias) {

  const vistas = new Set();

  return terapias.filter((terapia) => {

    const slug = obtenerSlug(terapia);

    if (vistas.has(slug)) {
      return false;
    }

    vistas.add(slug);

    return true;

  });

}


/*
  Obtiene el texto del precio.
  Conserva el tratamiento especial
  de aromaterapia.
*/
function obtenerPrecioTexto(terapia) {

  if (
    terapia.precio === null ||
    terapia.precio === undefined ||
    terapia.precio === ""
  ) {
    return "Consultar precio";
  }

  if (obtenerSlug(terapia) === "aromaterapia") {
    return String(terapia.precio);
  }

  return `$${terapia.precio} MXN`;

}


/* =========================================
   LISTADO DE TERAPIAS
========================================= */

async function cargarTerapias() {

  /*
    CORRECCIÓN PRINCIPAL:

    Permite cargar terapias tanto en
    index.html como en terapias.html.
  */

  const contenedor =
    document.getElementById("terapias-destacadas") ||
    document.getElementById("terapias-container");

  if (!contenedor) {
    return;
  }

  contenedor.setAttribute("aria-live", "polite");
  contenedor.setAttribute("aria-busy", "true");

  contenedor.innerHTML = "<p>Cargando terapias...</p>";

  try {

    /*
      Comprobar que Supabase esté disponible.
    */

    if (
      typeof supabaseClient === "undefined" ||
      !supabaseClient
    ) {
      throw new Error(
        "El cliente de Supabase no está disponible."
      );
    }

    /*
      Consultar terapias activas.
    */

    const { data, error } = await supabaseClient
      .from("therapies")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      throw error;
    }

    /*
      Si no hay terapias disponibles.
    */

    if (!data || data.length === 0) {

      contenedor.innerHTML = `
        <p>
          No hay terapias disponibles
          en este momento.
        </p>
      `;

      return;
    }

    /*
      Eliminar terapias duplicadas.
    */

    const terapias = quitarDuplicadosPorSlug(data);

    /*
      Limpiar mensaje de carga.
    */

    contenedor.innerHTML = "";

    /*
      Crear las tarjetas.
    */

    terapias.forEach((terapia) => {

      const slug = obtenerSlug(terapia);

      const imagen = obtenerImagenTerapia(terapia);

      const nombre = terapia.nombre || "Terapia";

      const precio = obtenerPrecioTexto(terapia);

      const duracion = terapia.duracion_minutos || 60;

      /*
        Crear tarjeta principal.
      */

      const card = document.createElement("article");

      card.classList.add("card", "therapy-card");

      /*
        Agregar contenido de la tarjeta.
      */

      card.innerHTML = `
        <img
          class="card-img"
          src="${textoSeguroHTML(imagen)}"
          alt="Servicio: ${textoSeguroHTML(nombre)}"
          loading="lazy"
        >

        <div class="card-body">

          <h3>
            ${textoSeguroHTML(nombre)}
          </h3>

          <p>
            ${textoSeguroHTML(
              terapia.descripcion || ""
            )}
          </p>

          <p>
            <strong>Duración:</strong>
            ${textoSeguroHTML(duracion)}
            minutos
          </p>

          <p>
            <strong>Precio:</strong>
            ${textoSeguroHTML(precio)}
          </p>

          <a
            href="terapia-detalle.html?terapia=${encodeURIComponent(slug)}"
          >
            Ver detalles de ${textoSeguroHTML(nombre)}
          </a>

        </div>
      `;

      /*
        Controlar errores de imágenes.
      */

      const img = card.querySelector("img");

      if (img) {

        img.addEventListener("error", () => {
          imagenFallback(img);
        });

      }

      /*
        Agregar tarjeta al contenedor.
      */

      contenedor.appendChild(card);

    });

    console.log(
      "Terapias cargadas correctamente:",
      terapias.length
    );

  } catch (error) {

    console.error(
      "Error al cargar las terapias:",
      error
    );

    contenedor.innerHTML = `
      <p>
        No fue posible cargar las terapias.
        Revisa tu conexión e intenta nuevamente.
      </p>
    `;

  } finally {

    contenedor.setAttribute(
      "aria-busy",
      "false"
    );

  }

}


/* =========================================
   DETALLE DE UNA TERAPIA
========================================= */

async function cargarDetalleTerapia() {

  /*
    Obtener los parámetros de la URL.
  */

  const params = new URLSearchParams(
    window.location.search
  );

  const terapiaId = params.get("id");

  const terapiaSlug = params.get("terapia");

  /*
    Obtener los elementos del HTML.
  */

  const nombre = document.getElementById(
    "terapia-nombre"
  );

  const descripcion = document.getElementById(
    "terapia-descripcion"
  );

  const duracion = document.getElementById(
    "terapia-duracion"
  );

  const precio = document.getElementById(
    "terapia-precio"
  );

  const imagen = document.getElementById(
    "terapia-imagen"
  );

  const botonAgendar = document.getElementById(
    "btn-agendar-terapia"
  );

  /*
    Comprobar que los elementos existan.
  */

  if (
    !nombre ||
    !descripcion ||
    !duracion ||
    !precio
  ) {
    return;
  }

  /*
    Comprobar que se recibió una terapia.
  */

  if (!terapiaId && !terapiaSlug) {

    nombre.textContent = "Terapia no encontrada";

    descripcion.textContent =
      "No se recibió un identificador de terapia válido.";

    duracion.textContent = "";

    precio.textContent = "";

    if (botonAgendar) {
      botonAgendar.hidden = true;
    }

    return;

  }

  try {

    /*
      Comprobar conexión con Supabase.
    */

    if (
      typeof supabaseClient === "undefined" ||
      !supabaseClient
    ) {
      throw new Error(
        "El cliente de Supabase no está disponible."
      );
    }

    /*
      Buscar la terapia activa.
    */

    let query = supabaseClient
      .from("therapies")
      .select("*")
      .eq("activo", true);

    if (terapiaId) {

      query = query.eq(
        "id",
        terapiaId
      );

    } else {

      query = query.eq(
        "slug",
        terapiaSlug
      );

    }

    const { data, error } = await query
      .limit(1)
      .single();

    if (error || !data) {

      throw error ||
        new Error("Terapia no encontrada");

    }

    /*
      Preparar datos de la terapia.
    */

    const slug = obtenerSlug(data);

    const nombreTerapia =
      data.nombre || "Terapia";

    /*
      Actualizar título de la página.
    */

    document.title =
      `${nombreTerapia} - Lombana Therapy`;

    /*
      Mostrar nombre.
    */

    nombre.textContent = nombreTerapia;

    /*
      Mostrar descripción.
      textContent evita interpretar HTML.
    */

    descripcion.textContent =
      data.descripcion_larga ||
      data.descripcion ||
      "";

    descripcion.style.whiteSpace = "pre-line";

    /*
      Mostrar duración.
    */

    duracion.textContent =
      "Duración: " +
      (data.duracion_minutos || 60) +
      " minutos";

    /*
      Mostrar precio.
    */

    precio.textContent =
      "Precio: " + obtenerPrecioTexto(data);

    /*
      Mostrar imagen.
    */

    if (imagen) {

      imagen.alt =
        "Servicio: " + nombreTerapia;

      imagen.onerror = function () {
        imagenFallback(imagen);
      };

      imagen.src =
        obtenerImagenTerapia(data);

    }

    /*
      Configurar botón de agendar.
    */

    if (botonAgendar) {

      botonAgendar.hidden = false;

      botonAgendar.href =
        "agendar.html?terapia=" +
        encodeURIComponent(slug);

    }

  } catch (error) {

    console.error(
      "Error al cargar el detalle de la terapia:",
      error
    );

    /*
      Mostrar mensaje de error.
    */

    nombre.textContent =
      "No se pudo cargar la terapia";

    descripcion.textContent =
      "La terapia no está disponible o " +
      "no fue posible consultarla. " +
      "Regresa al listado e intenta nuevamente.";

    duracion.textContent = "";

    precio.textContent = "";

    if (botonAgendar) {
      botonAgendar.hidden = true;
    }

  }

}
