# Software

Todo el código del sistema: el firmware que corre en la cámara, el servidor en la nube y el dashboard.

## Carpetas

| Carpeta | Contenido |
|---|---|
| `src/firmware/XIAO_Deteccion_WiFi/` | Firmware final de la XIAO ESP32-S3 Sense, con el modelo de detección embebido |
| `src/servidor/` | Servidor Express desplegado en Railway, conexión a PostgreSQL (Aiven) y dashboard |
| `librerias/` | Versiones de las librerías y del paquete de placas usados |
| `docs/` | Notas técnicas: flujo de datos y regla de decisión |

## Ciclo de datos

1. **Captura:** la cámara OV3660 toma una foto (JPEG) aproximadamente cada segundo.
2. **Clasificación:** el modelo de Teachable Machine (TensorFlow.js) asigna una probabilidad a cada clase: Sin basura, Botellas, Papeles y Cartones, Bolsas.
3. **Decisión:** se suman las tres clases de basura y se promedian las últimas 5 capturas. Si el promedio supera el umbral (80 % por defecto) en 3 evaluaciones seguidas, el sistema declara **"Hay basura"**.
4. **Almacenamiento:** el resultado se guarda en PostgreSQL (Aiven) a través del servidor de Railway.
5. **Visualización:** el dashboard muestra el estado actual, el histórico de detecciones y las alertas.

## Por qué esta frecuencia

Un microbasural se forma en horas, no en segundos. Pero una persona o un auto que pasa frente a la cámara puede tapar la escena por un momento. Capturar cerca de una vez por segundo y exigir varias lecturas seguidas evita falsas alarmas por objetos de paso, sin perder ninguna acumulación real.

## Cómo usarlo

Ver las instrucciones paso a paso en el [README principal](../README.md#️-instrucciones-de-uso).
