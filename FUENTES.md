# Fuentes del Proyecto

Declaración de librerías, código externo, modelos de terceros y uso de inteligencia artificial, según la pauta del Avance #3 (sección 6).

## Librerías utilizadas

| Librería | Versión | Uso en el proyecto | Fuente |
|---|---|---|---|
| Arduino-ESP32 (core de Espressif) | 3.3.0 | Base del firmware, `WiFi.h` para conexión y reconexión | https://github.com/espressif/arduino-esp32 |
| esp32-camera (`esp_camera.h`) | incluida en el core 3.3.0 | Control de la cámara OV3660 y buffers JPEG | https://github.com/espressif/esp32-camera |
| ESP-IDF HTTP Server (`esp_http_server.h`) | incluida en el core 3.3.0 | Servidor web de la placa: página, `/capture` y video MJPEG | https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/protocols/esp_http_server.html |
| FreeRTOS (`semphr.h`) | incluida en el core 3.3.0 | Mutex para compartir la cámara entre servidores | https://www.freertos.org |
| TensorFlow.js | 1.7.4 | Ejecuta el modelo de clasificación en el navegador | https://github.com/tensorflow/tfjs |
| @teachablemachine/image | 0.8.5 | Carga del modelo y preprocesamiento de imágenes | https://github.com/googlecreativelab/teachablemachine-community |
| Express | [VERSIÓN de package.json] | Servidor web y API en Railway | https://expressjs.com |
| pg (node-postgres) | [VERSIÓN de package.json] | Conexión del servidor con PostgreSQL | https://node-postgres.com |
| [Otra librería del servidor/dashboard, ej. Chart.js] | [VERSIÓN] | [USO] | [URL] |

Licencias de TensorFlow.js y Teachable Machine: Apache 2.0, ver `THIRD_PARTY_NOTICES.txt` y `APACHE_LICENSE.txt` junto al firmware.

## Servicios y herramientas

| Herramienta | Uso |
|---|---|
| Teachable Machine (Google) | Entrenamiento del clasificador con fotos propias tomadas con la XIAO (clases: Sin basura, Botellas, Papeles y Cartones, Bolsas) |
| Railway | Hosting del servidor y del dashboard |
| Aiven (PostgreSQL) | Base de datos persistente de detecciones |
| Autodesk Fusion 360 | Diseño del encapsulado y gemelo 3D |
| Arduino IDE | Compilación y carga del firmware |

## Modelos 3D de terceros

| Modelo | Fuente | Uso |
|---|---|---|
| Seeed Studio XIAO ESP32S3 Sense | https://grabcad.com/library/seeed-studio-xiao-esp32s3-sense-1 | Volumen referencial de la placa en el gemelo 3D |
| [Batería 523450 / interruptor SS12D00, si se descargaron] | [URL] | Volúmenes referenciales en el ensamble |

## Código externo adaptado

### Servidor y conexión a la base de datos (`software/src/servidor/server.js`)
- Fuente: Guía "ESP32 conectado a una base de datos en la nube — Aiven + Railway + GitHub", Fernando Méndez, TEI201 2026.
- Adaptación: [COMPLETAR: qué cambiaron, por ejemplo tabla `detecciones` con columnas de resultado y porcentaje en lugar de lecturas de sensor; endpoints propios; vistas del dashboard].

### Configuración de la cámara (`XIAO_Deteccion_WiFi.ino`, inicialización de la cámara)
- Fuente: ejemplo CameraWebServer del core Arduino-ESP32 y wiki de Seeed Studio para XIAO ESP32S3 Sense (https://wiki.seeedstudio.com/xiao_esp32s3_camera_usage/).
- Adaptación: pines de la XIAO, resolución y ajustes de imagen iguales a los usados para tomar las fotos de entrenamiento.

### Carga del modelo de Teachable Machine (`web_fuentes/app.js`)
- Fuente: fragmento de exportación "TensorFlow.js" que entrega Teachable Machine.
- Adaptación: el modelo y las librerías se sirven desde la flash de la placa (sin Internet); se agregó la regla de decisión por suma de clases de basura, promedio de 5 capturas y umbral ajustable.

## Uso de Inteligencia Artificial

> Completar cada bloque con la herramienta, fecha y prompt reales. Todos los integrantes deben poder explicar estas partes del código.

### Firmware del XIAO (`XIAO_Deteccion_WiFi.ino`)
- Herramienta: [ChatGPT / Claude / otro] ([mes] 2026)
- Prompt utilizado: "[PROMPT REAL]"
- Adaptación: [qué cambió el equipo]
- Comprensión: la placa inicia la cámara, se conecta al WiFi con reintentos cada 20 s sin bloquear `loop()`, y levanta dos servidores HTTP: puerto 80 (página, modelo y `/capture`) y puerto 81 (video MJPEG). Un mutex evita que dos peticiones usen la cámara a la vez.

### Regla de decisión de basura (`app.js`, funciones de agregación y decisión)
- Herramienta: [HERRAMIENTA] ([mes] 2026)
- Prompt utilizado: "[PROMPT REAL]"
- Adaptación: pasamos de exigir que una sola clase superara el 80 % a sumar las tres clases de basura, porque con objetos no entrenados el modelo repartía el porcentaje y nunca concluía.
- Comprensión: se guardan las últimas 5 probabilidades conjuntas de basura; con al menos 3 se promedia y se compara contra el umbral; se exigen 3 resultados consecutivos iguales para cambiar el veredicto.

### Script `herramientas/generar_assets.py`
- Herramienta: [HERRAMIENTA] ([mes] 2026)
- Uso: comprime con gzip la página, las librerías y el modelo, y los convierte en el arreglo de bytes `assets.h` que se graba en la flash.

### Servidor y dashboard (`software/src/servidor/`)
- Herramienta: [HERRAMIENTA] ([mes] 2026)
- Prompt utilizado: "[PROMPT REAL]"
- Adaptación y comprensión: [COMPLETAR]

### Documentación (README, BOM, este archivo)
- Herramienta: Claude (noviembre 2026)
- Uso: estructura base del README y del FUENTES.md a partir de la pauta; el contenido del proyecto fue revisado y completado por el equipo.
