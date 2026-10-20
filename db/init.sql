
-- LOMBANA THERAPY
-- PRACTICA 2 - DOCKER
-- Base de datos local de comprobacion
-- No modifica Supabase ni citas reales

CREATE TABLE IF NOT EXISTS public.docker_practice_status (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    servicio VARCHAR(100) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.docker_practice_status (servicio)
VALUES ('Lombana Therapy - PostgreSQL local');
