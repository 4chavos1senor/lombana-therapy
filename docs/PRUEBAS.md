# P1U3 — Lombana Therapy: resultados y evidencias de pruebas

**Fecha de ejecución:** 14 de octubre de 2026 (hora local de las capturas).  
**Aplicación:** `http://127.0.0.1:3000` (Node.js, conexión a Supabase).  
**Fuente:** capturas compartidas durante el trabajo de la práctica y resultado JSON facilitado por el alumno.  
**Estado:** los 10 casos de Postman fueron ejecutados o reportados como exitosos; hay capturas directas de Postman en **8** casos. Los casos 1 y 3 necesitan, si el docente exige evidencia gráfica individual, una captura adicional de Postman. No se inventaron capturas.

## Matriz de resultados del Bloque 11

| N.º | Prueba | Método / ruta | Esperado | Resultado reportado/observado | Evidencia disponible |
|---|---|---|---|---|---|
| 01 | Listar terapias | GET `/api/terapias` | 200 | 200 en curl; JSON de Postman con `ok:true`, 9 terapias; no se adjuntó captura del estado HTTP en Postman | `01_GET_terapias_200_curl_evidencia_complementaria.png`, `01_GET_terapias_respuesta_Postman.json` |
| 02 | Obtener terapia existente | GET `/api/terapias/masaje-relajante` | 200 | 200 OK; Test Results 1/1 | `02_GET_terapia_existente_200_Postman.png` |
| 03 | Terapia inexistente | GET `/api/terapias/no-existe` | 404 | El alumno reportó 404; no adjuntó captura de esa petición Postman; existe evidencia equivalente de 404 de *otra* ruta API usando curl | `03_GET_ruta_inexistente_404_curl_evidencia_complementaria.png` |
| 04 | Slug inválido | GET `/api/terapias/%21%21%21` | 400 | 400 Bad Request; Test Results 1/1; `VALIDACION` | `04_GET_slug_invalido_400_Postman.png` |
| 05 | Crear cita con sesión | POST `/api/citas` | 201 | 201 Created; Test Results 1/1; fecha 2026-11-10 | `05_POST_crear_cita_201_Postman.png` |
| 06 | Crear cita inválida | POST `/api/citas` | 400 | 400 Bad Request; Test Results 1/1; `VALIDACION` | `06_POST_cita_invalida_400_Postman.png` |
| 07 | Actualizar cita propia | PUT `/api/citas/:id` | 200 | 200 OK; Test Results 1/1; `status:cancelada` | `07_PUT_actualizar_cita_200_Postman.png` |
| 08 | Eliminar/cancelar lógicamente | DELETE `/api/citas/:id` | 204 | 204 No Content; Test Results 1/1 | `08_DELETE_cancelar_cita_204_Postman.png` |
| 09 | Ruta API inexistente | GET `/api/xyz` | 404 | 404 Not Found; Test Results 1/1; `RUTA_NO_ENCONTRADA` | `09_GET_ruta_api_404_Postman.png` |
| 10 | Proveedor externo caído (simulado) | GET `http://127.0.0.1:3001/api/terapias` | 503 | 503 Service Unavailable; Test Results 1/1; `PROVEEDOR_INDISPONIBLE` | `10_GET_proveedor_simulado_503_Postman.png` |

Las capturas están en `docs/evidencias-postman/`. **La prueba 10 usó un simulador local de fallo**, no una caída real del servicio Supabase. **La prueba 8 devolvió 204 y fue descrita como cancelación lógica**; un código 204 por sí solo no demuestra eliminación física de un registro.

## Evidencias técnicas complementarias

En `docs/evidencias-adicionales/` se incluyen capturas de:

- `npm test`: 12 tests, 12 aprobados, 0 fallidos (mocks, no sustituyen pruebas reales).
- `GET /api/salud`: HTTP 200 y cabeceras de seguridad.
- `GET /api/citas` sin autenticación: HTTP 401.

## Si el profesor solicita captura de Postman para cada caso

Solo se recomienda tomar dos capturas adicionales, sin repetir las pruebas que modifican datos:

1. **Prueba 01:** abrir `01 Listar terapias (200)`, pulsar **Send** y capturar la pantalla mostrando `200 OK`, `Test Results` y parte del JSON.
2. **Prueba 03:** abrir `03 Terapia inexistente (404)`, pulsar **Send** y capturar `404 Not Found`, `Test Results` y el JSON del error.

Ambas son solicitudes GET que no modifican citas. Guarda los archivos nuevos dentro de `docs/evidencias-postman/`.

## Seguridad de la evidencia

No incluir contraseñas, claves `sb_secret_`, JWT ni tokens de sesión en capturas, JSON exportado o GitHub. Al exportar la colección de Postman, elimina los tokens pegados en Authorization y desmarca o borra el valor de `sessionToken`. Revisa el JSON resultante antes de subirlo.

## Otras pruebas que aún requieren evidencia

Los resultados anteriores cubren **Bloque 11 (Postman)**, pero no cierran por sí solos los pendientes de RLS de Supabase, instalación limpia, licencia, roles, auditoría final ni todas las pruebas funcionales del frontend. Documentarlos por separado.
