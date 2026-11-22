# ♻️ Monitoreo Inteligente de Microbasurales — TEI201 2026

Cámara IoT de bajo costo (XIAO ESP32-S3 Sense) que vigila un punto crítico de Peñalolén y envía fotos a un servidor en la nube. Ahí un modelo de Machine Learning decide si hay basura acumulada, cada resultado queda guardado en una base de datos y un dashboard web muestra el estado en tiempo real y el histórico, para que la municipalidad priorice qué puntos limpiar.

**Dashboard:** https://xiao-monitor-production.up.railway.app/
**Estado:** ✅ Prototipo funcional — Avance #3 (23 de noviembre de 2026)

## 👥 Equipo

- Clemente Abarzúa
- Matías Armijo
- José Tomás De la Cuadra
- Santiago León

## 📌 Problema (Avance #1)

Peñalolén tiene cerca de **45 microbasurales** activos, con unos **220 m³ de residuos diarios** acumulados en ellos. Hoy la gestión es **reactiva**: los puntos se detectan por reclamos vecinales o recorridos, lo que retrasa el retiro y gasta recursos (más de **$5.124 millones** en gestión y retiro de residuos).

**Para quién:** Municipalidad de Peñalolén y sus equipos de aseo; indirectamente, los 236.478 habitantes de la comuna (Censo 2024) y quienes usan sus espacios públicos.

**Objetivo:** pasar de una gestión reactiva a una preventiva, sabiendo **cuándo y dónde** aparece basura sin tener que ir a mirar.

ODS relacionados: **11** (ciudades sostenibles) y **12** (producción y consumo responsables).

## 🏗️ Arquitectura

```
XIAO ESP32-S3 Sense + cámara OV3660
        │  foto JPEG cada 5 s (demo) o 15 s (estable), por HTTPS
        ▼
Servidor Node.js en Railway
        │  modelo Teachable Machine (TensorFlow.js) + regla de decisión
        ├──► PostgreSQL en Aiven (cada medición queda guardada)
        ▼
Dashboard web público: estado actual, gráficos e historial
Panel /admin: umbral, zona de análisis, giro, pausa, video y exportación CSV/JSON
```

**Regla de decisión:** el modelo clasifica cada foto en 4 clases (Sin basura, Botellas, Papeles y Cartones, Bolsas). Se suman las 3 clases de basura y se promedian las últimas fotos. Con umbral de 80 %: ≥ 80 % → "Hay basura", ≤ 20 % → "Sin basura" y lo intermedio es "No seguro". El resultado se confirma solo si se repite en evaluaciones seguidas. Así el sistema concluye aunque el residuo no sea exactamente uno de los entrenados, y no se deja engañar por algo que pasa un instante frente a la cámara. Detalle en [`software/docs/`](software/docs/README.md).

**Información para decidir:** el dashboard indica qué punto tiene basura confirmada y desde cuándo. El gráfico histórico muestra a qué horas aparece la basura, lo que permite programar el retiro en vez de esperar un reclamo.

## 🧰 Componentes para replicar el hardware

| Componente | Cant. |
|---|---|
| Seeed Studio XIAO ESP32-S3 Sense (cámara OV3660 + antena) | 1 |
| Batería LiPo 4.6 Wh | 1 |
| Interruptor deslizante | 1 |
| Carcasa impresa en 3D (2 mitades, 77 × 58 × 30 mm) | 1 |
| Insertos roscados de bronce M3 + tornillos | 2 + 2 |

Costo aproximado de materiales: **~27 USD por dispositivo**. Detalle, precios y esquema en [`hardware/`](hardware/).

## ▶️ Instrucciones de uso

### 1. Servidor y base de datos
1. Crea un PostgreSQL en Aiven (plan Free) y copia su Service URI y su certificado CA.
2. Despliega `software/src/servidor/` en Railway (Dockerfile incluido) y configura las variables de `.env.example`: `DATABASE_URL`, `DATABASE_CA_CERT`, `CAMERA_TOKEN`, `DASHBOARD_PASSWORD` y `SESSION_SECRET`.
3. Para probar localmente: `cd software/src/servidor && npm install && npm run dev`.

Guía detallada: [`software/src/servidor/README.md`](software/src/servidor/README.md).

### 2. Cargar el firmware
1. Instala **Arduino IDE**, el paquete **esp32 by Espressif Systems 3.3.x** y la librería **WebSockets** de Markus Sattler **2.7.2**.
2. Abre `software/src/firmware/XIAO_Remota/XIAO_Remota.ino`.
3. Copia `config.example.h` como `config.h` y completa tu red WiFi (2.4 GHz), la URL del servidor y el mismo `CAMERA_TOKEN` de Railway. **`config.h` no se sube al repositorio.**
4. En *Herramientas*: placa **XIAO_ESP32S3**, PSRAM **OPI PSRAM**, USB CDC On Boot **Enabled**. Sube el código.

### 3. Ver el dashboard
Abre https://xiao-monitor-production.up.railway.app/ desde cualquier red. Para ajustes y exportación de datos entra a `/admin` con la contraseña.

## 📁 Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `software/` | Firmware final de la XIAO, servidor con el modelo y dashboard |
| `hardware/` | Esquema de conexiones, BOM con costos y fotos del prototipo |
| `diseno_3d/` | Archivo Fusion 360 (.f3z), STL, plano en PDF y renders |
| `testing/` | Protocolo de pruebas, datos y evidencias |
| `iteraciones/` | Evolución: v1 cámara en el navegador → v2 detección ML → v3 nube y dashboard |
| `documentacion/` | Presentaciones de los tres avances |
| `FUENTES.md` | Librerías, código externo y uso de IA |

## 📊 Resultados clave

- **2.488 fotos analizadas** entre el 14 y el 22 de noviembre, todas guardadas en la base de datos.
- **0,36 s** de análisis por foto en el servidor (mediana).
- **~15 s** desde que aparece la basura hasta que el dashboard confirma "Hay basura" (mediana; rango 10–25 s, modo demo).
- El resumen por hora identifica cuándo aparece la basura (por ejemplo, 15:00 el 21 de noviembre).

Detalle, método y fallas encontradas en [`testing/`](testing/README.md).

## 🔐 Privacidad

El sistema detecta residuos, no personas. El monitor público muestra la miniatura de la última foto para verificar la detección. En una instalación real habría que limitar esa vista y definir cuánto tiempo se guardan las imágenes.

## 📚 Fuentes del problema

- Municipalidad de Peñalolén — Gestión de residuos; Estudio de Contexto y Enfoque EAE; PLADECO 2026–2030.
- Ministerio del Medio Ambiente — Santiago Recicla; Sistema de Certificación Ambiental Municipal.
- INE — Censo 2024.

Fuentes técnicas, librerías y uso de IA: ver [FUENTES.md](FUENTES.md).

## Licencia

MIT — ver [LICENSE](LICENSE).
