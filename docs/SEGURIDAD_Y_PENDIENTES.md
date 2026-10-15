# Seguridad: decisiones y pendientes reales

## Alcance confirmado
- El archivo .env se ignora y nunca se sirve en el backend de Node.
- La variable pública en `js/config.js` **no es secreta**: todo JavaScript ejecutado en el navegador puede verse desde DevTools.
- La API local valida tipos, formatos, IDs, máximo 100 kB, exige token para citas y reenvía las operaciones con el JWT del usuario, manteniendo las restricciones RLS.
- La API NO tiene credenciales `service_role`; no puede gestionar usuarios de Supabase Auth administrativamente.
- El servidor incluye CSP, cabeceras y CORS, pero los scripts/atributos inline actuales obligan a permitir `'unsafe-inline'`.

## Confirmar en el dashboard de Supabase
1. Tablas exactas y tipos para `profiles(id,email,nombre,telefono,genero,rol)`, `therapies(id,nombre,slug,precio,duracion_minutos,imagen_url,activo,descripcion,descripcion_larga)`, `appointments(id,user_id,therapy_id,fecha,hora_inicio,hora_fin,slot_id,status)`.
2. RLS activado para cada tabla. Un paciente no puede ver ni editar otros perfiles, reservar por otros usuarios, asignarse `rol=admin` o cambiar precios.
3. Administradores autorizados pueden listar clientes/citas y modificar terapias según rol y políticas RLS; probar con una cuenta admin real y una cuenta normal.
4. Política de ocupación de horarios: ¿puede haber más de un terapeuta en la misma hora? Solo aplicar restricción única si el negocio lo requiere y después de comprobar duplicados.
5. `auth.signUp` y el alta de `profiles`: revisar si trigger ya crea perfil automáticamente, para evitar duplicación en `js/auth.js`.
6. Añadir tests de acceso con dos usuarios y cuenta admin; nunca publicar sus JWT en repositorio.

## Acciones que no se han realizado
- No se cambió la instancia Supabase remota ni sus políticas.
- No se creó ninguna cuenta Auth ni se modificaron datos reales.
- No se eligió licencia; `package.json` permanece UNLICENSED.
- No se cambió el frontend a consumir exclusivamente `/api`; la API local se prueba por separado.
- No se entregan capturas inventadas ni se declara que Postman ya pasó contra Supabase real.

## Riesgo conocido en panel administrativo
La edición de perfiles en el panel **no permite modificar el email de autenticación ni contraseñas**; necesitaría una Edge Function o backend de privilegios controlados. El alta de cuentas nuevas debe pasar por `registro.html`, donde se crea el usuario Auth. La edición de terapias usa los nombres de columnas observados en JavaScript; verificar que coincidan con el esquema real antes de usar en producción.
