# Auditoría — P1U3, Lombana Therapy

Fecha de preparación: 14/10/2026. Basada en inspección estática y doce pruebas automatizadas **aisladas**. No se pudo conectar a la instancia real de Supabase ni verificar GitHub, políticas RLS o pruebas manuales. `✅` implementado en código; `⚠️` implementación/evidencia pendiente; `❌` requiere decisión o trabajo externo.

| # | Requisito de la práctica | Estado inicial del ZIP | Estado final de archivos preparados | Evidencia / siguiente acción |
|---|---|---|---|---|
| 1 | .gitignore excluye .env y dependencias | ✅ | ✅ | `.gitignore`; confirmar `git ls-files .env` local |
| 2 | Datos sensibles fuera del código | ✅ clave publicable | ⚠️ | `.env` y `js/config.js`; revisar historial remoto; clave publicable no es secreto |
| 3 | .env.example sin secretos | ✅ | ✅ | `.env.example`; `npm run build:config` |
| 4 | Endpoints con nombres claros | ❌ | ✅ | `server.cjs` `/api/terapias`, `/api/citas`; frontend original aún usa Supabase directo |
| 5 | Respuestas JSON uniformes | ❌ | ✅ | API local `ok`, `data`, `total`, `error` |
| 6 | Validación de entradas | ⚠️ frontend | ⚠️ | Backend valida formato, tipo y límite 100 kB; revisar RLS, SQL y reglas de negocio reales |
| 7 | Códigos HTTP adecuados | ⚠️ externo | ⚠️ | API envía 200/201/204/400/401/404/409/502/503; probar 409 con restricción BD |
| 8 | Manejo centralizado de errores | ⚠️ | ✅ | `server.cjs` captura errores; detalle solo en log, no al usuario |
| 9 | 404 de API controlado | ❌ | ✅ | GET `/api/no-existe` devuelve 404 JSON |
| 10 | CORS restrictivo | ⚠️ | ✅ en servidor local | `.env` `ALLOWED_ORIGIN`; verificar con curl/buscador |
| 11 | Cabeceras de seguridad | ⚠️ | ✅ básico | `server.cjs`; CSP con unsafe-inline por compatibilidad |
| 12 | HTML head completo | ✅ parcial | ✅ | 8 HTML del ZIP; verificar metadatos en navegador |
| 13 | Fuentes alojadas localmente | ✅ usa fuentes del sistema | ✅ | No necesita descargar Google Fonts |
| 14 | Página 404 personalizada | ⚠️ archivo existente | ✅ servidor local | `404.html` entregado con estado 404; probar navegador |
| 15 | LICENSE | ❌ | ❌ | Requiere autorización de titulares. `UNLICENSED` provisional |
| 16 | README con instalación real | ⚠️ desactualizado | ✅ preparado | `README.md` nuevo; verificar por otra persona |
| 17 | Logs de peticiones | ❌ sin API propia | ✅ servidor local | Método, ruta, código, tiempo; sin bodies ni tokens |
| 18 | Versiones de dependencias fijadas | ✅ | ✅ | `package-lock.json`, bundle local |

## Evidencias externas pendientes
- Capturas del funcionamiento real del frontend con Supabase: registro, sesión, catálogo, reservas, administración.
- Resultados de 10 peticiones Postman/curl y capturas de HTTP, seguridad y CORS.
- Revisar estructura real de BD, índice antirreservas duplicadas y RLS, y obtener aprobación para ejecutar SQL.
- Elegir licencia y confirmación escrita del equipo.
- Probar instalación en otra computadora siguiendo README.
- Captura de rama de Git, commits, revisión y merge (no se incluyen en ZIP).

## Tres mejoras UI/UX detectadas (Bloque 9)
1. Unificar mensajes de error de Supabase sin mostrar textos internos al paciente (pendiente de prueba manual).
2. Agregar indicador de envío y deshabilitar doble clic en «Confirmar cita» mientras guarda (pendiente de implementación y prueba).
3. Verificar contraste y estados de foco del menú hamburguesa en móvil con herramientas de accesibilidad (pendiente de prueba manual).
