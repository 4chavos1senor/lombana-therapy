Auditoría — P1U3, Lombana Therapy
Fecha de preparación: 14/10/2026. Basada en inspección estática y doce pruebas automatizadas aisladas. No se pudo conectar a la instancia real de Supabase ni verificar GitHub, políticas RLS o pruebas manuales. ✅ implementado en código; ⚠️ implementación/evidencia pendiente; ❌ requiere decisión o trabajo externo.
#	Requisito de la práctica	Estado inicial del ZIP	Estado final de archivos preparados	Evidencia / siguiente acción	Estado después de la práctica 2
1	.gitignore excluye .env y dependencias	✅	✅	.gitignore; confirmar git ls-files .env local	✅ .gitignore; git check-ignore .env y node_modules/; git ls-files .env vacío.
2	Datos sensibles fuera del código	✅ clave publicable	⚠️	.env y js/config.js; revisar historial remoto; clave publicable no es secreto	⚠️ .env ignorado y ausente del commit; .dockerignore lo excluye. Historial y recursos de terceros pendientes de revisar.
3	.env.example sin secretos	✅	✅	.env.example; npm run build:config	✅ .env.example con TU_PROYECTO, TU_CLAVE_AQUI y DB_PASSWORD=; sin contraseña real.
4	Endpoints con nombres claros	❌	✅	server.cjs /api/terapias, /api/citas; frontend original aún usa Supabase directo	✅ Tres rutas GET comprobadas en Swagger (openapi.yaml); el frontend sigue usando Supabase directo.
5	Respuestas JSON uniformes	❌	✅	API local ok, data, total, error	✅ /api/salud y /api/terapias respondieron JSON ok/data (Swagger UI, HTTP 200).
6	Validación de entradas	⚠️ frontend	⚠️	Backend valida formato, tipo y límite 100 kB; revisar RLS, SQL y reglas de negocio reales	⚠️ server.cjs y pruebas automatizadas; faltan pruebas de integración de reglas de negocio/RLS.
7	Códigos HTTP adecuados	⚠️ externo	⚠️	API envía 200/201/204/400/401/404/409/502/503; probar 409 con restricción BD	⚠️ Tres GET con HTTP 200 en Swagger; conflictos 409 comprobados en pruebas aisladas, no en reservas reales.
8	Manejo centralizado de errores	⚠️	✅	server.cjs captura errores; detalle solo en log, no al usuario	✅ server.cjs centraliza errores; 36 pruebas automatizadas aprobadas.
9	404 de API controlado	❌	✅	GET /api/no-existe devuelve 404 JSON	✅ server.cjs conserva la respuesta JSON 404 para rutas API inexistentes.
10	CORS restrictivo	⚠️	✅ en servidor local	.env ALLOWED_ORIGIN; verificar con curl/buscador	⚠️ ALLOWED_ORIGIN configurado en .env.example; prueba independiente de CORS pendiente.
11	Cabeceras de seguridad	⚠️	✅ básico	server.cjs; CSP con unsafe-inline por compatibilidad	⚠️ Cabeceras definidas en server.cjs; falta revisión de seguridad completa.
12	HTML head completo	✅ parcial	✅	8 HTML del ZIP; verificar metadatos en navegador	➖ Sin cambios en esta práctica; metadatos no revalidados exhaustivamente.
13	Fuentes alojadas localmente	✅ usa fuentes del sistema	✅	No necesita descargar Google Fonts	➖ Sin cambios en esta práctica; fuentes de sistema según revisión P1.
14	Página 404 personalizada	⚠️ archivo existente	✅ servidor local	404.html entregado con estado 404; probar navegador	✅ nginx/default.conf y 404.html; localhost:8080/nada comprobado en navegador.
15	LICENSE	❌	❌	Requiere autorización de titulares. UNLICENSED provisional	✅ LICENSE MIT autorizado (2026, Lombana) y package.json con license: MIT.
16	README con instalación real	⚠️ desactualizado	✅ preparado	README.md nuevo; verificar por otra persona	✅ README.md actualizado; clonación local independiente y docker compose up --build -d exitosos.
17	Logs de peticiones	❌ sin API propia	✅ servidor local	Método, ruta, código, tiempo; sin bodies ni tokens	✅ Logs GET /... 200 observados en backend; docker compose logs -f backend documentado.
18	Versiones de dependencias fijadas	✅	✅	package-lock.json, bundle local	⚠️ package-lock.json versionado e imágenes sin latest; nginx:alpine y otras etiquetas no fijan digest.


Evidencias externas pendientes
- Capturas del funcionamiento real del frontend con Supabase: registro, sesión, catálogo, reservas, administración.
- Resultados de 10 peticiones Postman/curl y capturas de HTTP, seguridad y CORS.
- Revisar estructura real de BD, índice antirreservas duplicadas y RLS, y obtener aprobación para ejecutar SQL.
- Elegir licencia y confirmación escrita del equipo.
- Probar instalación en otra computadora siguiendo README.
- Captura de rama de Git, commits, revisión y merge (no se incluyen en ZIP).
Tres mejoras UI/UX detectadas (Bloque 9)
1. Unificar mensajes de error de Supabase sin mostrar textos internos al paciente (pendiente de prueba manual).
2. Agregar indicador de envío y deshabilitar doble clic en «Confirmar cita» mientras guarda (pendiente de implementación y prueba).
3. Verificar contraste y estados de foco del menú hamburguesa en móvil con herramientas de accesibilidad (pendiente de prueba manual).
Actualización — Práctica 2 (19/10/2026)
Alcance: estos estados se refieren al trabajo de Docker Compose y OpenAPI en la rama practica-distribucion. Las columnas originales y la lista de pendientes de la P1U3 se mantienen como registro histórico; no representan por sí solas el estado actual.
Evidencia técnica comprobada en la Práctica 2
- Dockerfile, .dockerignore, Dockerfile.frontend, docker-compose.yml, nginx/default.conf y db/init.sql presentes en la rama de trabajo.
- docker compose ps: backend y frontend en ejecución, db marcado healthy.
- Instalación independiente desde una clonación local en lombana-therapy-verificacion (misma computadora): construcción y arranque exitosos. No es una prueba en otro equipo físico.
- Frontend en http://localhost:8080, API en http://localhost:3000/api/salud y Swagger UI en http://localhost:3000/api-docs, comprobados manualmente.
- Swagger UI: HTTP 200 para GET /api/salud, GET /api/terapias y GET /api/terapias/ajustes-quiropracticos.
- openapi.yaml: sintaxis YAML comprobada; Swagger Editor mostró los tres endpoints sin errores visibles.
- PostgreSQL local: SELECT id, servicio, creado_en FROM public.docker_practice_status; devolvió un registro; no prueba que la API use esta base.
- npm.cmd test: 36 pruebas aprobadas, cero fallidas, según la salida compartida; no son pruebas exhaustivas de producción.
- Rama subida a GitHub con commits 02ed4ba y f99f87d. Pull Request #11 abierto en borrador, sin fusión a main.
- Informe de evidencias: P2_Distribucion_Lombana_Therapy.pdf preparado con capturas del proceso.