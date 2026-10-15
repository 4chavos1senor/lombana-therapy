-- LOMBANA THERAPY: SOLO CONSULTAS. No cambian datos ni políticas.
-- Ejecutar en SQL Editor de Supabase y compartir resultados SIN datos de pacientes,
-- sin credenciales ni tokens. Usar este resultado antes de proponer migraciones RLS.

-- 1. Columnas, tipos y obligatoriedad
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('profiles','therapies','appointments')
ORDER BY table_name, ordinal_position;

-- 2. Tablas con RLS activada
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname='public' AND tablename IN ('profiles','therapies','appointments')
ORDER BY tablename;

-- 3. Políticas vigentes (sin mostrar registros privados)
SELECT schemaname, tablename, policyname, roles, cmd, permissive, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('profiles','therapies','appointments')
ORDER BY tablename, policyname;

-- 4. Índices y restricciones existentes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('profiles','therapies','appointments')
ORDER BY tablename,indexname;

-- 5. Claves externas declaradas
SELECT tc.table_name, kcu.column_name, ccu.table_name AS tabla_referida, ccu.column_name AS columna_referida
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name AND tc.table_schema=ccu.table_schema
WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY'
AND tc.table_name IN ('profiles','therapies','appointments')
ORDER BY tc.table_name,kcu.column_name;
