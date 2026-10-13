# Pruebas pendientes (para realizar en local)

No se han ejecutado estas pruebas contra Supabase real. Registra **fecha, resultado y captura** por cada caso.

1. `index.html`: abre sin errores en Consola de Chrome.
2. `terapias.html`: muestra catálogo; texto de nombres/descripciones se ve sin interpretar etiquetas HTML.
3. `terapia-detalle.html?terapia=masaje-relajante`: detalle carga y conserva saltos de línea.
4. `registro.html`: nombre corto/correo inválido/contraseña de menos de 8 caracteres se rechazan localmente.
5. `login.html`: iniciar y cerrar sesión; prueba `?redirect=https://ejemplo.com` y confirma que **no** redirige a otros dominios.
6. `mis-citas.html`: sin sesión lleva a login; con sesión muestra sus citas; prueba cancelación.
7. `agendar.html`: una reserva válida; doble reserva del mismo horario por dos navegadores (requiere protección en BD).
8. `admin.html`: con rol paciente se rechaza acceso; intenta consulta/modificación directa a Supabase y verifica RLS.
9. `404.html`: abre como archivo; configura una ruta inválida en hosting y verifica HTTP 404 real.
10. En DevTools → Network verifica errores y códigos HTTP para consultas a Supabase y cabeceras de seguridad.

## Ejemplo de lectura de API sin datos privados
Usa la consola Network del navegador para ver solicitudes reales a `/rest/v1/therapies` y sus cabeceras. Si usas curl, pon claves en variables de entorno locales y NO compartas tokens de sesión. Una petición a la API REST de Supabase no equivale a una API propia de Express.

## Evidencia de CORS
Prueba un Origin permitido/no permitido contra el servicio correspondiente y consigna el resultado; recuerda que curl no aplica la política CORS del navegador.
