# ♻️ Monitoreo Inteligente de Microbasurales — TEI201 2026

Cámara IoT de bajo costo (XIAO ESP32-S3 Sense) que vigila un punto crítico de Peñalolén, detecta con Machine Learning si hay basura acumulada y registra cada detección en una base de datos en la nube. Un dashboard web muestra el estado en tiempo real y el histórico, para que la municipalidad priorice qué puntos limpiar.

**Dashboard:** https://xiao-monitor-production.up.railway.app/
**Estado:** ✅ Prototipo funcional — Avance #3 (23 de noviembre de 2026)

## 👥 Equipo

- Clemente Abarzúa
- Matías Armijo
- José Tomás De la Cuadra
- Santiago León

## 📌 Problema (Avance #1)

Peñalolén tiene cerca de **45 microbasurales** activos, con unos **220 m³ de residuos diarios** acumulados en ellos. Hoy la gestión es **reactiva**: los puntos se detectan por reclamos vecinales o recorridos, lo que retrasa el retiro y gasta recursos (más de **$5.124 millones** en gestión y retiro de residuos).

**Para quién:** Municipalidad de Peñalolén y sus equipos de aseo; indirectamente, vecinos y usuarios de los espacios públicos.

**Objetivo:** pasar de una gestión reactiva a una preventiva, sabiendo **cuándo y dónde** aparece basura sin tener que ir a mirar.

ODS relacionados: **11** (ciudades sostenibles) y **12** (producción y consumo responsables).

## 🏗️ Arquitectura

```
XIAO ESP32-S3 Sense + cámara OV3660
        │  captura de imagen
        ▼
Modelo Teachable Machine (TensorFlow.js)
        │  ¿hay basura? (Botellas + Papeles/Cartones + Bolsas ≥ umbral)
        ▼
Servidor Express en Railway  ──►  Base de datos PostgreSQL (Aiven)
        │
        ▼
Dashboard web: estado actual, histórico y alertas
```

**Regla de decisión:** el modelo clasifica en 4 clases (Sin basura, Botellas, Papeles y Cartones, Bolsas). Se suman las 3 clases de basura, se promedian las últimas 5 capturas y se declara "Hay basura" cuando ese promedio supera el umbral (80 % por defecto) de forma consecutiva. Así el sistema concluye aunque el objeto no sea exactamente uno de los entrenados.

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

### 1. Cargar el firmware
1. Instala **Arduino IDE** y el paquete de placas **esp32 by Espressif Systems 3.3.0**.
2. Abre `software/src/firmware/XIAO_Deteccion_WiFi/XIAO_Deteccion_WiFi.ino` (con `assets.h` en la misma carpeta).
3. En *Herramientas* selecciona: Placa **XIAO_ESP32S3**, PSRAM **OPI PSRAM**, USB CDC On Boot **Enabled**, Partition Scheme **Maximum APP (7.9MB APP No OTA/No FS)**.
4. Al inicio del sketch reemplaza `NOMBRE_DE_TU_WIFI` y `CONTRASENA_DE_TU_WIFI` por tu red (debe ser de 2.4 GHz). **No subas tu contraseña real al repositorio.**
5. Sube el código y abre el monitor serie a 115200 baudios para ver la IP.

### 2. Servidor y base de datos
1. El código del servidor está en `software/src/servidor/`.
2. Crea un servicio PostgreSQL gratuito en Aiven y copia la URL de conexión.
3. Copia `.env.example` como `.env` y completa `DATABASE_URL`.
4. Local: `npm install` y luego `npm start`. Nube: el repo está conectado a Railway, que despliega solo con cada push.

### 3. Ver el dashboard
Abre https://xiao-monitor-production.up.railway.app/

## 📁 Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `software/` | Firmware final del XIAO, servidor (Railway) y dashboard |
| `hardware/` | Esquema de conexiones, BOM con costos y fotos del prototipo |
| `diseno_3d/` | Archivo Fusion 360 (.f3z), STL, planos en PDF y renders |
| `testing/` | Protocolo de pruebas, datos exportados y evidencias |
| `iteraciones/` | Evolución del prototipo: v1 cámara web → v2 detección ML → v3 nube |
| `documentacion/` | Presentaciones de los tres avances e informes |
| `FUENTES.md` | Librerías, código externo y uso de IA |

## 📊 Resultados clave

[COMPLETAR con los números reales de testing/: por ejemplo, "X de Y pruebas detectadas correctamente (Z %)", latencia de detección en segundos y la falla principal encontrada.]

## 🔐 Privacidad

El sistema detecta residuos, no personas. Las imágenes se procesan para decidir "hay / no hay basura" y lo que se guarda en la base de datos es el resultado de la detección, no la identificación de quienes pasan.

## 📚 Fuentes del problema

- Municipalidad de Peñalolén — Gestión de residuos; Estudio de Contexto y Enfoque EAE; PLADECO 2026–2030.
- Ministerio del Medio Ambiente — Santiago Recicla; Sistema de Certificación Ambiental Municipal.
- INE — Censo 2024.

Fuentes técnicas, librerías y uso de IA: ver [FUENTES.md](FUENTES.md).

## Licencia

MIT — ver [LICENSE](LICENSE).
