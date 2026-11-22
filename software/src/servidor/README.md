# Servidor y dashboard (Railway + PostgreSQL en Aiven)

**Dashboard en vivo:** https://xiao-monitor-production.up.railway.app/

> Esta carpeta es una copia del repositorio de despliegue [`santileonv/camara-basura`](https://github.com/santileonv/camara-basura) (carpeta `app/`, commit `8c39e1c`, 22/11/2026). Railway despliega desde ese repositorio, rama `main`, raíz `/app`.

## Qué hace

1. **Recibe fotos** de la cámara: `POST /api/ingest`, por HTTPS, autenticado con `CAMERA_TOKEN`.
2. **Analiza cada foto** con el modelo de Teachable Machine (`model/`) usando TensorFlow.js en Node. Antes gira la imagen, recorta la zona de análisis y la escala a 224 × 224 con `sharp`.
3. **Decide** con la regla de suma de clases y promedio móvil (ver `lib/decision.js` y `software/docs/README.md`).
4. **Guarda** cada medición en PostgreSQL (Aiven): tabla `mediciones` (`database/schema.sql`).
5. **Muestra** el monitor público: estado actual, porcentajes por clase, avance de la decisión, gráfico "¿Hay basura?", gráfico de probabilidad e historial. Se actualiza en vivo con Server-Sent Events (`/api/events`).
6. **Administra** en `/admin`, con contraseña: giro de la cámara, zona de análisis, umbral (60–95 %), pausa de capturas, video en vivo para orientar la cámara y exportación de datos a JSON/CSV.

## Estructura

| Carpeta / archivo | Contenido |
|---|---|
| `server.js` | Punto de entrada |
| `lib/` | Lógica: decisión, modelo, base de datos, autenticación, eventos en vivo, video |
| `api/` | Rutas HTTP: ingesta, estado, historial, gráficos, administración, exportación |
| `public/` | Página del monitor y del panel de administración (HTML, CSS, JS sin librerías externas) |
| `database/schema.sql` | Tablas `camaras`, `estado_camara` y `mediciones` |
| `model/` | Modelo de Teachable Machine (`model.json`, `metadata.json`, `weights.bin`) |
| `scripts/` | Migración, copia a Aiven, importación de historial y verificación del modelo |
| `test/` | Pruebas automáticas (`npm test`) |
| `Dockerfile` | Imagen usada por Railway |

## Ejecutar localmente

Requiere Node.js 22.

```bash
npm install
cp .env.example .env    # completar DATABASE_URL, CAMERA_TOKEN, DASHBOARD_PASSWORD y SESSION_SECRET
npm run db:migrate
npm run dev
npm test                # pruebas automáticas
```

## Variables de entorno

Se configuran solo en **Railway → servicio → Variables**, nunca en GitHub. La plantilla es `.env.example`.

| Variable | Uso |
|---|---|
| `DATABASE_URL` / `DATABASE_CA_CERT` | Conexión TLS a PostgreSQL de Aiven |
| `CAMERA_TOKEN` | Clave compartida con el `config.h` de la cámara |
| `DASHBOARD_PASSWORD`, `SESSION_SECRET` | Acceso al panel `/admin` |
| `THRESHOLD` | Umbral inicial (0.80) si no hay uno guardado |
| `DETECTION_PROFILE` | `demo` (promedio de 3, 2 confirmaciones) o `stable` (promedio de 5, 3 confirmaciones) |
| `STALE_AFTER_SECONDS` | Segundos sin datos para considerar el estado vencido (90) |

Documentación completa del despliegue: [`software/docs/servidor_detalle.md`](../../docs/servidor_detalle.md).
