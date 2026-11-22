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
| Express | ver `package.json` del servidor | Servidor web y API en Railway | https://expressjs.com |
| pg (node-postgres) | ver `package.json` del servidor | Conexión del servidor con PostgreSQL | https://node-postgres.com |

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
| Batería Li-ion 523450 e interruptor SPDT SS12D00 | Modelos públicos de terceros vinculados al ensamble de Fusion 360 | Volúmenes referenciales en el gemelo 3D (no diseñados por el equipo) |

## Código externo adaptado

### Servidor y conexión a la base de datos (`software/src/servidor/server.js`)
- Fuente: Guía "ESP32 conectado a una base de datos en la nube — Aiven + Railway + GitHub", Fernando Méndez, TEI201 2026.
- Adaptación: en lugar de lecturas de un sensor, el servidor guarda el resultado de cada detección de basura y el dashboard muestra el estado actual y el histórico.

### Configuración de la cámara (`XIAO_Deteccion_WiFi.ino`, inicialización de la cámara)
- Fuente: ejemplo CameraWebServer del core Arduino-ESP32 y wiki de Seeed Studio para XIAO ESP32S3 Sense (https://wiki.seeedstudio.com/xiao_esp32s3_camera_usage/).
- Adaptación: pines de la XIAO, resolución y ajustes de imagen iguales a los usados para tomar las fotos de entrenamiento.

### Carga del modelo de Teachable Machine (`web_fuentes/app.js`)
- Fuente: fragmento de exportación "TensorFlow.js" que entrega Teachable Machine.
- Adaptación: el modelo y las librerías se sirven desde la flash de la placa (sin Internet); se agregó la regla de decisión por suma de clases de basura, promedio de 5 capturas y umbral ajustable.

## Uso de Inteligencia Artificial

Usamos **Claude (Anthropic)** durante todo el proyecto, entre septiembre y noviembre de 2026, para escribir y depurar código y para ordenar la documentación. Todo lo generado fue probado en el prototipo real y adaptado por el equipo. Cada integrante puede explicar qué hace cada parte.

### Firmware del XIAO (`software/src/firmware/XIAO_Deteccion_WiFi/XIAO_Deteccion_WiFi.ino`)
- Herramienta: Claude (septiembre–octubre 2026)
- Uso: pedimos un firmware para la XIAO ESP32-S3 Sense que transmitiera la cámara a una página web. Primero en una red propia (modo AP, iteración 1) y después conectado a una red WiFi externa (iteración 3).
- Adaptación: ajustes de imagen iguales a los usados para tomar las fotos de entrenamiento; esquema de particiones *Maximum APP* para que el modelo quepa en la flash; comentarios por secciones.
- Comprensión: la placa inicia la cámara, se conecta al WiFi con reintentos cada 20 s sin bloquear `loop()` y levanta dos servidores HTTP: puerto 80 (página, modelo y `/capture`) y puerto 81 (video MJPEG). Un mutex evita que dos peticiones usen la cámara al mismo tiempo.

### Página de detección y regla de decisión (`web_fuentes/app.js`, `web_fuentes/index.html`)
- Herramienta: Claude (octubre 2026)
- Uso: integrar el modelo exportado de Teachable Machine en una página que pide capturas a la placa y las clasifica en el navegador.
- Adaptación: el equipo detectó que con objetos no entrenados el sistema nunca concluía, porque ninguna clase llegaba sola al 80 %. Pedimos cambiar la regla para sumar las tres clases de basura y promediar las últimas 5 capturas.
- Comprensión: se guardan las últimas 5 probabilidades de basura; con al menos 3 se promedia y se compara con el umbral (80 %); el veredicto solo cambia si el mismo resultado se repite 3 veces seguidas.

### Script `herramientas/generar_assets.py`
- Herramienta: Claude (octubre 2026)
- Uso: comprimir con gzip la página, las librerías y el modelo, y convertirlos en el arreglo de bytes `assets.h` que se graba en la flash. Así la placa funciona sin Internet ni tarjeta SD.

### Servidor, base de datos y dashboard (`software/src/servidor/`)
- Herramienta: Claude (noviembre 2026), siguiendo la guía del curso Aiven + Railway.
- Uso: servidor Express que recibe las detecciones, las guarda en PostgreSQL (Aiven) y sirve el dashboard en Railway.
- Adaptación: se adaptó la guía del curso para guardar detecciones de basura en lugar de lecturas de sensor.
- Comprensión: el servidor recibe cada detección por HTTP, la inserta en una tabla de PostgreSQL en Aiven y la página del dashboard consulta esa tabla para mostrar el estado actual y el histórico.

### Documentación y organización del repositorio
- Herramienta: Claude (noviembre 2026)
- Uso: estructura del repositorio, README de cada carpeta, este archivo y protocolo de pruebas, a partir de la pauta del Avance #3 y del repositorio de ejemplo del curso. Los datos del proyecto (problema, medidas, componentes y resultados) son del equipo.
