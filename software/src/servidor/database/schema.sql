-- Ejecutar en el SQL Editor de una base PostgreSQL dedicada al proyecto.
-- No incluye DROP, TRUNCATE ni borrado de registros existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS camaras (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  ubicacion text,
  creada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO camaras (id, nombre) VALUES ('camara-1', 'Camara XIAO 1')
ON CONFLICT (id) DO NOTHING;

-- La pausa persiste sin borrar mediciones y bloquea tambien escrituras en curso.
ALTER TABLE camaras ADD COLUMN IF NOT EXISTS capturas_pausadas boolean NOT NULL DEFAULT false;

-- La orientacion es compartida por el analisis y todos los monitores.
-- La version impide guardar una inferencia iniciada antes de cambiar el giro.
ALTER TABLE camaras
  ADD COLUMN IF NOT EXISTS rotacion smallint NOT NULL DEFAULT 180 CHECK (rotacion IN (0, 180)),
  ADD COLUMN IF NOT EXISTS orientacion_version bigint NOT NULL DEFAULT 0 CHECK (orientacion_version >= 0);

-- 180 grados es el valor inicial; los ajustes del administrador se conservan.
-- La misma version protege el giro y el umbral frente a inferencias en curso.
ALTER TABLE camaras ALTER COLUMN rotacion SET DEFAULT 180;
ALTER TABLE camaras DROP CONSTRAINT IF EXISTS camaras_rotacion_fija;
ALTER TABLE camaras ADD COLUMN IF NOT EXISTS umbral_decision double precision
  CHECK (umbral_decision BETWEEN 0.60 AND 0.95);
-- Recuadro cuadrado: centro relativo a la imagen orientada y tamaño respecto al lado corto.
ALTER TABLE camaras ADD COLUMN IF NOT EXISTS zona_analisis jsonb NOT NULL
  DEFAULT '{"centerX":0.5,"centerY":0.5,"size":1}'::jsonb
  CHECK (CASE WHEN jsonb_typeof(zona_analisis)='object'
    AND jsonb_typeof(zona_analisis->'centerX')='number'
    AND jsonb_typeof(zona_analisis->'centerY')='number'
    AND jsonb_typeof(zona_analisis->'size')='number'
    THEN zona_analisis=jsonb_build_object('centerX',zona_analisis->'centerX','centerY',zona_analisis->'centerY','size',zona_analisis->'size')
      AND (zona_analisis->>'centerX')::numeric BETWEEN 0 AND 1
      AND (zona_analisis->>'centerY')::numeric BETWEEN 0 AND 1
      AND (zona_analisis->>'size')::numeric BETWEEN 0.15 AND 1
    ELSE false END);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'camaras'::regclass AND conname = 'camaras_rotacion_valida') THEN
    ALTER TABLE camaras ADD CONSTRAINT camaras_rotacion_valida CHECK (rotacion IN (0, 180));
  END IF;
END $$;

-- Solo una fila por camara: ventana de promedio y ultima miniatura.
CREATE TABLE IF NOT EXISTS estado_camara (
  camara_id text PRIMARY KEY REFERENCES camaras(id),
  revision bigint NOT NULL CHECK (revision > 0),
  estado jsonb NOT NULL CHECK (jsonb_typeof(estado) = 'object'),
  actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Una fila por captura analizada. Las probabilidades se guardan entre 0 y 1.
CREATE TABLE IF NOT EXISTS mediciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  camara_id text NOT NULL REFERENCES camaras(id),
  recibido_en timestamptz NOT NULL,
  arranque text NOT NULL CHECK (arranque ~ '^[a-f0-9]{16}$'),
  secuencia bigint NOT NULL CHECK (secuencia >= 0),
  conclusion text NOT NULL CHECK (conclusion IN ('Hay basura', 'Sin basura', 'No seguro')),
  p_sin_basura double precision NOT NULL CHECK (p_sin_basura BETWEEN 0 AND 1),
  p_botellas double precision NOT NULL CHECK (p_botellas BETWEEN 0 AND 1),
  p_papeles_cartones double precision NOT NULL CHECK (p_papeles_cartones BETWEEN 0 AND 1),
  p_bolsas double precision NOT NULL CHECK (p_bolsas BETWEEN 0 AND 1),
  basura_actual double precision NOT NULL CHECK (basura_actual BETWEEN 0 AND 1),
  basura_promedio double precision NOT NULL CHECK (basura_promedio BETWEEN 0 AND 1),
  umbral double precision NOT NULL CHECK (umbral BETWEEN 0.60 AND 0.95),
  capturas_promedio smallint NOT NULL CHECK (capturas_promedio BETWEEN 1 AND 5),
  confirmaciones smallint NOT NULL CHECK (confirmaciones BETWEEN 0 AND 3),
  analisis_ms integer NOT NULL CHECK (analisis_ms >= 0),
  UNIQUE (camara_id, arranque, secuencia),
  CHECK (abs(p_sin_basura + p_botellas + p_papeles_cartones + p_bolsas - 1) <= 0.001)
);

CREATE INDEX IF NOT EXISTS mediciones_camara_id_desc ON mediciones (camara_id, id DESC);
-- Navegacion por fechas y busqueda de la medicion anterior al borde del grafico.
CREATE INDEX IF NOT EXISTS mediciones_camara_fecha_desc ON mediciones (camara_id, recibido_en DESC, id DESC);
COMMIT;
