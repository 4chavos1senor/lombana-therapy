# Auditoría de Lombana Therapy — práctica Unidad 3

**Alcance:** revisión estática del ZIP; no se ejecutaron conexiones reales ni se verificó la configuración externa del hosting y Supabase. Estados: ✅ resuelto en archivos; ⚠️ parcial/por confirmar; ❌ pendiente/no aplica como implementación propia.

| # | Requisito | Estado tras revisión | Evidencia o acción |
|---|---|---|---|
| 1 | .gitignore para `.env` y dependencias | ✅ | `.gitignore` creado |
| 2 | Secretos fuera del código | ⚠️ | `js/supabase.js` contiene valores **publicables**. Verificar que no haya secrets en repositorio/historial |
| 3 | `.env.example` | ⚠️ | Incluido como plantilla; sitio estático no carga env automáticamente |
| 4 | Endpoints claros | ❌ | No existen endpoints propios; se consume PostgREST de Supabase |
| 5 | JSON uniforme | ❌ | Formato de respuestas lo controla Supabase; no hay proxy propio |
| 6 | Validar entradas | ⚠️ | Registro validado en navegador; imprescindible reforzar en BD/RLS |
| 7 | Códigos HTTP | ⚠️ | Los determina Supabase; no hay controladores propios |
| 8 | Manejo central de errores | ⚠️ | Mensajes seguros en páginas corregidas; restantes scripts pendientes |
| 9 | 404 API | ❌ | Resuelto por Supabase/hosting, no por esta web |
| 10 | CORS restrictivo | ⚠️ | Revisar configuración en servicios reales y hosting |
| 11 | Cabeceras seguridad | ⚠️ | Requiere hosting; no hay servidor configurable en ZIP |
| 12 | HTML head completo | ✅ | Añadidos viewport y descriptions faltantes; lang ya existía |
| 13 | Fuentes locales | ✅ | CSS usa Arial del sistema; no usa Google Fonts |
| 14 | Página 404 | ⚠️ | Creado `404.html`; hosting debe dirigir los 404 hacia ella |
| 15 | LICENSE | ❌ | No se asignó sin autorización de titulares |
| 16 | README | ✅ | Archivo incluido con instrucciones reales |
| 17 | Logs | ⚠️ | Consola del navegador y registros administrados por Supabase; no hay logs de backend propio |
| 18 | Dependencias fijas | ⚠️ | Supabase CDN @2 sigue sin fijación exacta ni copia local |

## Arreglos funcionales adicionales
- `mis-citas.html`: se conecta a `js/mis-citas.js`, ya no a `js/agenda.js`.
- Eliminado archivo duplicado `mis-citas.js` de la raíz.
- `js/terapias.js` y `js/mis-citas.js`: los campos dinámicos se muestran con APIs DOM seguras (`textContent`), sin interpolar información de BD en `innerHTML`.
- `js/auth.js`: validación básica de registro y redirecciones internas con lista permitida.

## Pendientes de evidencias
Probar pantalla inicial, registro, login, catálogo, horarios, creación/cancelación de cita y permisos del administrador en la instancia real. Adjuntar pruebas en `docs/PRUEBAS.md`. Crear rama y commits desde el repositorio Git original (un ZIP no incluye el historial Git).
