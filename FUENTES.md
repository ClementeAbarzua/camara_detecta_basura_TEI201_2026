# Fuentes del Proyecto

Declaración de librerías, código externo, modelos de terceros y uso de inteligencia artificial, según la pauta del Avance #3 (sección 6).

## Librerías utilizadas

### Firmware de la cámara (`software/src/firmware/XIAO_Remota/`)

| Librería | Versión | Uso en el proyecto | Fuente |
|---|---|---|---|
| Arduino-ESP32 (core de Espressif) | 3.3.x | Base del firmware; `WiFi.h` para conexión y reconexión | https://github.com/espressif/arduino-esp32 |
| esp32-camera (`esp_camera.h`) | incluida en el core | Control de la cámara OV3660 y captura JPEG | https://github.com/espressif/esp32-camera |
| ESP-IDF HTTP Client (`esp_http_client.h`) | incluida en el core | Envío HTTPS de las fotos al servidor | https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/protocols/esp_http_client.html |
| WebSockets (Markus Sattler) | 2.7.2 | Video en vivo hacia `/admin` para orientar la cámara | https://github.com/Links2004/arduinoWebSockets |

### Servidor y dashboard (`software/src/servidor/`)

| Librería | Versión | Uso en el proyecto | Fuente |
|---|---|---|---|
| @tensorflow/tfjs | 4.22.0 | Ejecuta el modelo de Teachable Machine en el servidor | https://github.com/tensorflow/tfjs |
| sharp | 0.35.5 | Gira, recorta y escala cada foto a 224 × 224 | https://sharp.pixelplumbing.com |
| pg (node-postgres) | 8.23.1 | Conexión TLS a PostgreSQL de Aiven | https://node-postgres.com |
| ws | 8.23.0 | Recepción del video en vivo por WebSocket | https://github.com/websockets/ws |
| @electric-sql/pglite | 0.5.16 | PostgreSQL en memoria, solo para las pruebas automáticas | https://github.com/electric-sql/pglite |

El servidor usa el módulo `http` de Node.js (sin Express). La página del dashboard está escrita sin librerías externas: los gráficos son SVG propios.

### Versión anterior (`software/src/firmware/XIAO_Deteccion_WiFi/`)

TensorFlow.js 1.7.4 y @teachablemachine/image 0.8.5, embebidos en `assets.h` (Apache 2.0, ver `THIRD_PARTY_NOTICES.txt` y `APACHE_LICENSE.txt` en esa carpeta).

## Servicios y herramientas

| Herramienta | Uso |
|---|---|
| Teachable Machine (Google) | Entrenamiento del clasificador con fotos propias tomadas con la XIAO (clases: Sin basura, Botellas, Papeles y Cartones, Bolsas) |
| Railway | Hosting del servidor y del dashboard, desplegado desde GitHub |
| Aiven (PostgreSQL, plan Free) | Base de datos persistente de las mediciones |
| GitHub | Código del servidor (`santileonv/camara-basura`) y respaldo del proyecto |
| Autodesk Fusion 360 | Diseño del encapsulado y gemelo 3D |
| Arduino IDE | Compilación y carga del firmware |

## Modelos 3D de terceros

| Modelo | Fuente | Uso |
|---|---|---|
| Seeed Studio XIAO ESP32S3 Sense | https://grabcad.com/library/seeed-studio-xiao-esp32s3-sense-1 | Volumen referencial de la placa en el gemelo 3D |
| Batería Li-ion 523450 e interruptor SPDT SS12D00 | Modelos públicos de terceros vinculados al ensamble de Fusion 360 | Volúmenes referenciales en el gemelo 3D (no diseñados por el equipo) |

## Código externo adaptado

### Arquitectura servidor + base de datos en la nube (`software/src/servidor/`)
- Fuente: Guía "ESP32 conectado a una base de datos en la nube — Aiven + Railway + GitHub", Fernando Méndez, TEI201 2026.
- Adaptación: la guía envía lecturas de un sensor. En nuestro proyecto la cámara envía fotos, el servidor ejecuta el modelo de clasificación y guarda en la tabla `mediciones` las probabilidades de cada clase, el promedio, el umbral y la conclusión. Se agregaron un panel de administración, gráficos históricos y video para orientar la cámara.

### Configuración de la cámara (inicialización en los `.ino`)
- Fuente: ejemplo CameraWebServer del core Arduino-ESP32 y wiki de Seeed Studio para XIAO ESP32S3 Sense (https://wiki.seeedstudio.com/xiao_esp32s3_camera_usage/).
- Adaptación: pines de la XIAO, resolución de 800 × 600 y ajustes de imagen iguales a los usados para tomar las fotos de entrenamiento.

### Modelo de Teachable Machine (`software/src/servidor/model/`)
- Fuente: exportación "TensorFlow.js" de Teachable Machine, entrenada por el equipo con fotos propias.
- Adaptación: en lugar de correr en el navegador, el modelo se carga en el servidor. Se agregaron el recorte de la zona de análisis y la regla de decisión por suma de clases de basura.

## Uso de Inteligencia Artificial

Usamos **Claude (Anthropic)** durante todo el proyecto, entre septiembre y noviembre de 2026, para escribir y depurar código y para ordenar la documentación. Todo lo generado se probó en el prototipo real y fue adaptado por el equipo, que puede explicar cada parte.

### Firmware de la cámara (`XIAO_Remota.ino`, `capture-schedule.h`)
- Herramienta: Claude (septiembre–noviembre 2026)
- Uso: empezamos con un firmware que transmitía la cámara a una página web en una red propia (iteración 1). Después pasamos a uno que se conecta a una red WiFi externa (iteración 3) y finalmente a uno que envía las fotos por HTTPS a Railway.
- Adaptación: ajustes de imagen iguales a los del entrenamiento, ciclo de 5 s para la demo y de 15 s para operación normal, pausa remota desde el panel y video para orientar la cámara en la instalación.
- Comprensión: la placa se conecta al WiFi y reintenta si se cae; toma una foto JPEG, la envía por HTTPS a `/api/ingest` con un token y espera lo que falta para completar el ciclo. Usa certificados raíz para validar el servidor. Solo hace conexiones salientes, por eso no requiere abrir puertos.

### Servidor y regla de decisión (`software/src/servidor/`)
- Herramienta: Claude (noviembre 2026), siguiendo la guía del curso Aiven + Railway.
- Uso: servidor Node.js que recibe las fotos, ejecuta el modelo, aplica la regla de decisión, guarda en PostgreSQL y sirve el dashboard.
- Adaptación: el equipo detectó en la iteración 2 que con objetos no entrenados el sistema nunca concluía, porque ninguna clase llegaba sola al 80 %. Pedimos sumar las tres clases de basura, promediar las últimas fotos y agregar el estado "No seguro" para no confundir una lectura dudosa con "Sin basura".
- Comprensión: `lib/decision.js` suma Botellas + Papeles y Cartones + Bolsas y promedia las últimas 3 (demo) o 5 (estable) fotos. Si el promedio es ≥ umbral propone "Hay basura", si es ≤ (1 − umbral) propone "Sin basura" y si no, "No seguro". El resultado se confirma tras 2 o 3 evaluaciones seguidas iguales. Cada medición se inserta en la tabla `mediciones` y la página recibe un aviso en vivo para actualizarse.

### Dashboard (`software/src/servidor/public/`)
- Herramienta: Claude (noviembre 2026)
- Uso: monitor con estado actual, avance de la decisión, gráfico "¿Hay basura?" en el tiempo, gráfico de probabilidad con umbrales e historial; panel `/admin` con ajustes y exportación.
- Adaptación: el equipo definió qué información mostrar para responder al problema (si hay basura, desde cuándo y a qué horas aparece) y ajustó el umbral, el giro y la zona de análisis según la instalación real.

### Versión anterior: detección en el navegador (`XIAO_Deteccion_WiFi/`, `generar_assets.py`)
- Herramienta: Claude (octubre 2026)
- Uso: página que ejecutaba el modelo en el navegador y script que comprimía página, librerías y modelo en `assets.h` para grabarlos en la flash de la placa.

### Documentación y organización del repositorio
- Herramienta: Claude (noviembre 2026)
- Uso: estructura del repositorio, README de cada carpeta, este archivo y protocolo de pruebas, a partir de la pauta del Avance #3 y del repositorio de ejemplo del curso. Los datos del proyecto (problema, medidas, componentes y resultados) son del equipo.
