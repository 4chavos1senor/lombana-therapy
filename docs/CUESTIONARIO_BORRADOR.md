# Cuestionario técnico: BORRADOR para revisión del equipo

Basado en las 30 preguntas del archivo «ERICK SOTO CUEVAS – P1U3». **No presentar sin revisarlo con el equipo y adaptarlo a sus propias palabras**. Las preguntas que exigen evidencias deben acompañarse con capturas/curl reales. Las decisiones no tomadas se indican como **pendiente**.

## A. Variables de entorno y datos sensibles

**1.** No basta con borrar el archivo, porque la contraseña permanece en commits anteriores del historial remoto. Debe revocarse/cambiarse el secreto, retirarlo del repositorio e historial según el procedimiento del equipo y evitar que se vuelva a versionar.

**2.** `.env` contiene valores específicos del equipo, que no se comparten. `.env.example` solo documenta los nombres de las variables y pone marcadores no reales; el primero se ignora en Git y el segundo sí se versiona.

**3.** Fallar al inicio localiza el problema en la configuración y evita que los usuarios reciban fallos ambiguos más tarde. `server.cjs` valida `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `ALLOWED_ORIGIN` antes de escuchar el puerto.

**4.** En Lombana Therapy: `SUPABASE_URL` identifica la instancia y cambia entre ambientes; `SUPABASE_PUBLISHABLE_KEY` cambia al usar otra instancia (es pública, no un secreto); `ALLOWED_ORIGIN` depende del puerto/dominio permitido. `PORT` también puede cambiar entre entornos.

## B. Endpoints y JSON

**5.** Mezcla el verbo `crear` con la ruta y usa camelCase en lugar de sustantivo en plural. Debe expresarse como `POST /api/usuarios` (si el negocio requiere ese recurso).

**6.** Un contrato uniforme permite que el frontend compruebe siempre `ok`, use `data` y presente un error de `error.mensaje` sin inventar una interpretación diferente por ruta. La API local muestra este patrón.

**7.** Se rompen enlaces del frontend, llamadas fetch, pruebas y documentación. Buscar la ruta anterior en el repositorio, actualizar la colección Postman y ejecutar pruebas de regresión y las pantallas afectadas.

## C. Validación de entradas

**8.** Con Postman o curl se puede llamar directamente al servidor y saltarse el HTML y sus atributos `required`. Por ello la API valida el cuerpo de las citas y RLS valida permisos de acceso a Supabase.

**9.** La primera concatena la entrada sin parametrizar y puede permitir inyección SQL. La segunda pasa el valor como parámetro; en este proyecto se usa la API de Supabase/PostgREST, nunca SQL formado concatenando cadenas de un paciente.

**10.** Ejemplos: **tipo**: duración debe ser número entero; **formato**: `fecha` debe cumplir YYYY-MM-DD y ser fecha real; **longitud**: `slug` no superar 100 caracteres; **valor**: `hora_fin` posterior a `hora_inicio`.

## D. Códigos de estado HTTP

**11.** Los clientes podrían tratar una operación fallida como exitosa y las métricas/logs clasificarían fallas como 200. El monitoreo y las herramientas HTTP dejarían de distinguir errores de validación o caídas del servicio.

**12.** `400` si fecha u horario llegan con formato inválido; `404` si se pide una terapia inexistente; `409` cuando dos reservas chocan con una restricción de horario activo, **solo si se aplica dicha restricción en PostgreSQL**.

**13.** Un 4xx indica problema de la petición o permiso y suele corregirlo el cliente; un 5xx apunta a un error o indisponibilidad del servidor/proveedor. Ayuda a decidir si revisar entradas o infraestructura.

**14.** Se debe devolver `502 Bad Gateway` cuando Supabase responde con un fallo del proveedor. No es un éxito 200, ni un recurso 404, ni necesariamente un fallo inesperado de nuestro código 500; si ni siquiera hay conexión, el proyecto usa 503.

**15.** La promesa de `fetch` se resuelve también con 404, por lo que hay que revisar `respuesta.ok` o `respuesta.status` antes de interpretar el JSON y mostrar el error correspondiente.

## E. Errores, 404 y logs

**16.** Las trazas pueden revelar consultas, rutas internas o estructura del servidor. Deben registrarse en el servidor sin contraseñas ni datos privados completos; el cliente solo recibe un mensaje controlado.

**17.** En Express el middleware 404 colocado antes interceptaría las rutas posteriores. En esta implementación nativa primero se comparan todas las rutas y finalmente se envía 404 si ninguna coincide.

**18.** Experiencia: explica que la página no existe y ofrece regreso. Seguridad: evita respuestas por defecto con detalles del servidor. Técnica: permite mantener HTTP 404 y distinguir páginas HTML de errores JSON.

**19.** No. Una ruta de interfaz devuelve `404.html` con `text/html` y 404; `/api/xyz` devuelve 404 con JSON `{ok:false,error:{...}}`. El navegador y los clientes de API tienen necesidades distintas.

**20.** Se podrían imprimir contraseñas y datos de un paciente en un log compartido. La regla violada es no registrar cuerpos completos ni secretos; el servidor registra ruta, método, código y duración, nunca el body o Authorization.

## F. CORS y cabeceras

**21.** CORS controla qué orígenes de páginas pueden leer respuestas entre dominios desde el navegador; el servidor anuncia orígenes admitidos y **el navegador** aplica la restricción. curl no usa esa política y requiere autenticación para datos privados igual que cualquier cliente.

**22.** Con `*` cualquier origen puede leer respuestas públicas, lo que amplía la exposición si el diseño depende erróneamente de CORS. Puede ser aceptable en un servicio completamente público, sin credenciales ni datos sensibles, con políticas de acceso apropiadas.

**23.** `X-Content-Type-Options: nosniff` reduce interpretaciones MIME peligrosas; `Content-Security-Policy` limita fuentes de contenido, reduciendo riesgo de inyección de recursos. Quitar `X-Powered-By` disminuye la divulgación del framework. Esta CSP todavía usa `unsafe-inline` por compatibilidad.

## G. Frontend, fuentes y licencia

**24.** `charset=UTF-8` hace que los acentos sean interpretados correctamente; `viewport` favorece el diseño móvil; `lang=es` permite a lectores de pantalla pronunciar según el idioma. Si faltan, empeora legibilidad o accesibilidad.

**25.** Evita peticiones a terceros, reduce dependencias de red y permite funcionamiento consistente sin conexión. Antes de copiar un archivo de fuente se debe revisar su permiso de redistribución y conservar avisos de licencia. Lombana Therapy usa fuentes del sistema, sin copiar Google Fonts.

**26.** La fuente no carga y el navegador usa una tipografía alternativa; en DevTools > Network se vería 404 al pedir el `.woff2` relativo a la carpeta del CSS. Lombana Therapy actualmente no necesita esa ruta porque usa fuentes del sistema.

**27.** No automáticamente. Un repositorio público no equivale a una licencia que permita modificar y redistribuir. Por eso el paquete sigue `UNLICENSED` hasta que los titulares acuerden licencia.

**28.** MIT es permisiva, permite redistribuir con aviso; GPL exige distribuir derivados bajo la misma licencia al distribuirlos; AGPL extiende obligaciones a quien ofrece versiones modificadas como servicio de red. **Pendiente**: escribir la decisión real de los titulares y actualizar `LICENSE` y `package.json`.

## H. Pruebas y documentación

**29.** Permite observar por separado estado, cabeceras, JSON y validaciones sin mezclar problemas de HTML, JavaScript o estilos. Sirve para descubrir 400, 401, 404, 500, 502 y CORS que en pantalla se verían solo como «no cargó».

**30.** Le faltan: requisitos/versiones, variables `.env`, pasos de instalación, configuración de base de datos/RLS, puerto y URL, rutas/códigos HTTP, instrucciones de pruebas y responsables/licencia. El README incluido desarrolla esos apartados, dejando pendientes las decisiones externas.

