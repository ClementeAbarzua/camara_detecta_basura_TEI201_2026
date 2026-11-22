# Fuentes

**Proyecto:** detector y monitor remoto de basura con Seeed Studio XIAO ESP32-S3 Sense.  
**Asignatura:** TALLER DISEÑO.  
**Actualización:** 22 de noviembre de 2026.  
**Repositorio de entrega:** [ClementeAbarzua/camara_detecta_basura_TEI201_2026](https://github.com/ClementeAbarzua/camara_detecta_basura_TEI201_2026).  
**Repositorio de despliegue (Railway):** [santileonv/camara-basura](https://github.com/santileonv/camara-basura).  
**Integrantes:** Clemente Abarzúa, Matías Armijo, José Tomás De la Cuadra y Santiago León.  
**Versión del código revisada:** commit [`8c39e1c3f25b998f4eb10cf8e402822d804936ec`](https://github.com/santileonv/camara-basura/commit/8c39e1c3f25b998f4eb10cf8e402822d804936ec), aplicación `3.2.0`. Incluye las mejoras integradas hasta el pull request #23.
**Material de diseño incorporado:** documentación, plano y seis vistas CAD enviados por el equipo el 21 de noviembre de 2026, hora de Chile.

Este archivo reúne el origen del código, las bibliotecas, el modelo de aprendizaje automático, los datos y la documentación técnica utilizados durante el desarrollo. Conserva el esquema del archivo de referencia proporcionado y lo adapta a este proyecto. En el repositorio de entrega, el servidor (`software/src/servidor/` en el repositorio de despliegue) está en `software/src/servidor/` y el firmware en `software/src/firmware/XIAO_Remota/`; las rutas de este documento usan esa ubicación.

La implementación documentada captura fotografías en la XIAO, las envía por HTTPS a Railway, ejecuta allí el modelo de Teachable Machine y almacena resultados y ajustes en PostgreSQL de Aiven. La página pública muestra el estado y los gráficos; el panel privado permite modificar la orientación, la zona de análisis y el umbral, pausar o reanudar la detección, exportar datos y activar video continuo exclusivamente dentro del editor de la zona de análisis. El dashboard incorpora estados con colores, avisos visuales, sonido opcional, tendencias por hora y resumen del día seleccionado.

## Código externo adaptado y código del proyecto

| Elemento | Origen | Uso |
|---|---|---|
| Firmware de captura y envío remoto | Desarrollo del proyecto, con asistencia de ChatGPT/Codex y documentación de Seeed Studio y Espressif. Archivo: `software/src/firmware/XIAO_Remota/XIAO_Remota.ino`. | Inicialización de cámara, conexión WiFi, sincronización de hora, captura JPEG, autenticación y envío HTTPS. |
| Definición de los pines de la cámara y configuración de PSRAM | [Documentación de cámara de Seeed Studio](https://wiki.seeedstudio.com/xiao_esp32s3_camera_usage/) y [controlador de cámara de Espressif](https://github.com/espressif/esp32-camera). | Compatibilidad con la XIAO ESP32-S3 Sense y su módulo de cámara. |
| Ejemplos de carga y predicción del modelo | Código de exportación y [biblioteca de imágenes de Teachable Machine, Google Creative Lab](https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image), Apache-2.0. | Referencia para integrar el modelo entrenado, identificar clases y preparar imágenes. |
| Modelo entrenado | Entrenamiento realizado para el proyecto mediante [Teachable Machine](https://teachablemachine.withgoogle.com/), sobre una base MobileNet de TensorFlow. | Clasificación de imágenes en Sin basura, Botellas, Papeles y Cartones y Bolsas. |
| Servidor y API | Desarrollo del proyecto con asistencia de ChatGPT/Codex. Archivos principales: `software/src/servidor/server.js`, `software/src/servidor/lib/http-server.js` y `software/src/servidor/api/`. | Recepción de capturas, consulta pública, autenticación administrativa y coordinación de análisis y persistencia. El servidor utiliza el módulo HTTP nativo de Node.js. |
| Procesamiento previo a la inferencia | Desarrollo del proyecto sobre las API de TensorFlow.js y Sharp. Archivo: `software/src/servidor/lib/model.js`. | Giro, recorte de la zona de análisis, preparación de RGB a 224 × 224, carga del modelo, predicción y generación de miniaturas. |
| Lógica de decisión | Desarrollo del proyecto. Archivos: `software/src/servidor/lib/decision.js` y `software/src/servidor/lib/config.js`. | Suma de las tres clases de residuos, promedio móvil, umbrales simétricos, confirmaciones consecutivas y estado No seguro. |
| Base de datos, consultas y migraciones | Desarrollo del proyecto sobre PostgreSQL y node-postgres. Archivos: `software/src/servidor/database/schema.sql`, `software/src/servidor/lib/store.js`, `software/src/servidor/lib/migrate.js` y `software/src/servidor/scripts/`. | Registro de mediciones y ajustes, historial, agregación por minutos y migración de Railway a Aiven. |
| Monitor, estilos y temas | Desarrollo del proyecto con HTML, CSS y JavaScript, con asistencia de ChatGPT/Codex. Directorio: `software/src/servidor/public/`. | Consulta pública, miniatura, porcentajes, avance de la decisión, temas claro y oscuro y diseño adaptable. |
| Gráficos y navegación temporal | Desarrollo del proyecto mediante SVG y API del navegador. Archivos: `charts.js`, `chart-data.js`, `chart-overview.js` y `charts.css`, en `software/src/servidor/public/`. | Gráfico de escalones, probabilidad de basura, fecha, intervalos, barras sincronizadas, mapa de registros y ajuste manual de los extremos del intervalo. |
| Administración y edición de la zona | Desarrollo del proyecto. Archivos: `software/src/servidor/lib/admin-auth.js`, `software/src/servidor/api/admin.js`, `software/src/servidor/public/admin.js`, `roi-editor.js` y `roi-geometry.js`. | Sesiones privadas, control de acceso, giro, umbral y selección de un recorte cuadrado persistente. |
| Pruebas automatizadas | Desarrollo del proyecto con Node.js y PGlite. Directorio: `software/src/servidor/test/`. | Verificación de reglas, API, PostgreSQL, permisos, tratamiento de imágenes, perfiles de captura e interacciones del monitor. |
| README, instrucciones y respaldo del método anterior | Documentación del proyecto elaborada con asistencia de ChatGPT/Codex. Archivos: `software/docs/servidor_detalle.md` y `software/docs/MODO_DEMO_Y_REVERSION.md`. | Instalación, operación, explicación técnica y recuperación del perfil previo. |
| Pausa remota y estado del dispositivo | Desarrollo del proyecto sobre HTTP/HTTPS y control versionado. Archivos: `software/src/servidor/api/operations.js`, `software/src/servidor/lib/device-status.js`, `software/src/servidor/lib/store.js`, `software/src/servidor/public/admin-tools.js` y firmware XIAO. | Pausa persistente en PostgreSQL, bloqueo del análisis y registro, consulta de órdenes por el firmware y reanudación con una ventana de decisión nueva. |
| Exportación administrativa | Desarrollo del proyecto con node-postgres y flujos HTTP de Node.js. Archivos: `software/src/servidor/api/admin-export.js` y `software/src/servidor/lib/database-export.js`. | JSON de las tres tablas del proyecto o CSV de mediciones; todo el historial o un intervalo, con sesión privada, lectura consistente y entrega por lotes. |
| Video continuo privado | Integración del proyecto mediante `ws` y WebSockets de Markus Sattler. Archivos: `software/src/servidor/lib/device-video.js`, `software/src/servidor/lib/live-preview.js`, `software/src/servidor/api/live-preview.js`, `software/src/servidor/public/admin-live.js` y firmware. | JPEG continuos por WSS desde la XIAO y retransmisión MJPEG autenticada al administrador; vista única en el recuadro de la zona de análisis, con giro y reconexión automática. |
| Presentación en vivo y alertas | Desarrollo del proyecto con DOM, CSS y Web Audio API. Archivos: `software/src/servidor/public/dashboard-data.js`, `dashboard-live.js` y `dashboard.css`. | Colores semánticos, acción sugerida, hora de lectura, estado de conexión, avisos de confirmación y tonos opcionales sin archivos de audio externos. |
| Tendencias y cambios por hora | Desarrollo del proyecto mediante SQL, DOM y CSS. Archivos: `software/src/servidor/api/decision-trends.js`, `software/src/servidor/lib/store.js`, `software/src/servidor/public/decision-trends.js` y `dashboard-data.js`. | Conteos y porcentajes de las tres conclusiones, comparación horaria, hora con más registros de basura y últimas confirmaciones; enlace de cada hora a los gráficos históricos. |
| Carcasa y ensamble CAD | Diseño del equipo en Autodesk Fusion; autor del plano: Matías Armijo H. Referencias y evidencias en el apartado de diseño 3D de este documento. | Integración de placa, cámara, batería, interruptor, cableado y disipador representado; dos mitades, acceso USB-C y lente, abertura del interruptor y ranuras laterales. |
| Organización de este archivo | Archivo `FUENTES.md` proporcionado como esquema de referencia. | Estructura de las secciones y tablas de atribución. Las fuentes del ejemplo se reemplazan por las que corresponden al detector XIAO. |

### Evolución de la arquitectura

| Etapa | Elementos utilizados | Alcance |
|---|---|---|
| Prototipo local | XIAO, cámara, WiFi en modo punto de acceso y una interfaz local. | Permitió comprobar capturas y clasificación en el navegador. En esa etapa se trabajó con una interfaz incorporada al firmware mediante `assets.h`. |
| Conexión a una red existente | WiFi en modo estación, router o conexión compartida desde un iPhone. | Se pasó de crear una red propia a utilizar una red con acceso a Internet y se depuraron las reconexiones. |
| Monitor remoto | GitHub y Railway, con el modelo ejecutándose en el servidor. | Acceso desde dispositivos y redes diferentes; análisis independiente de que el monitor esté abierto. |
| Persistencia inicial | PostgreSQL alojado en Railway. | Primer registro de cámaras, estado e historial. |
| Persistencia en Aiven | PostgreSQL administrado por Aiven y scripts de copia del proyecto. | Traslado de los registros y posterior uso de Aiven como base del servicio. |
| Interfaz y administración | SVG, historial por fecha, eventos del servidor, autenticación y ajustes persistentes. | Consulta pública y cambios reservados al administrador; retirada de la descarga pública de datos. |
| Operación administrativa ampliada | Control remoto, exportación privada y canal de video continuo. | Se añadieron pausa/reanudación y exportaciones solo administrativas. La primera vista de imágenes periódicas se sustituyó por video continuo WSS/MJPEG; la vista grande se retiró y el video quedó únicamente dentro del editor de la zona de análisis. |
| Dashboard para apoyar decisiones | Alertas del monitor y agregación horaria sobre las mediciones de Aiven. | Colores, avisos sin duplicados, sonido opcional, resumen diario y navegación desde una hora a sus gráficos. No se cambió el algoritmo del clasificador ni sus umbrales con esta mejora. |
| Perfil de demostración | Planificador del firmware y reglas configurables del servidor. | Objetivo de ciclo de 5 s, promedio de hasta 3 capturas y 2 confirmaciones consecutivas. El perfil estable previo conserva promedio de 5 capturas y 3 confirmaciones. |

Los tiempos anteriores son parámetros del sistema, no garantías de latencia ni resultados de una evaluación experimental. El archivo `software/docs/MODO_DEMO_Y_REVERSION.md` documenta la reversión. La versión remota actual no necesita `assets.h`: la XIAO captura y envía; Railway procesa; el navegador presenta la información.

### Autoría y licencias del código del proyecto

El código específico del proyecto se desarrolló iterativamente con participación del equipo y asistencia de ChatGPT/Codex para generación, explicación, depuración, pruebas y documentación. Esta asistencia no sustituye la atribución de los componentes de terceros.

El repositorio de entrega incluye una licencia MIT (`LICENSE`) para el código propio del equipo. `APACHE_LICENSE.txt` y `THIRD_PARTY_NOTICES.txt` conservan los avisos de los componentes externos, que mantienen sus propias licencias.

## Librerías de software

### Servidor, procesamiento de imágenes y pruebas

| Librería o componente | Versión identificada | Dónde se usa | Licencia | Sitio |
|---|---|---|---|---|
| TensorFlow.js (`@tensorflow/tfjs`) | 4.22.0 | Carga del modelo, tensores y predicción en Railway; incluye sus módulos de capas, conversión y backends. La aplicación selecciona CPU. | Apache-2.0 | [TensorFlow.js](https://www.tensorflow.org/js) · [Código y licencia](https://github.com/tensorflow/tfjs) |
| node-postgres (`pg`) | 8.23.1 | Conexiones, pool, consultas parametrizadas y transacciones PostgreSQL. | MIT | [Documentación](https://node-postgres.com/) · [Código y licencia](https://github.com/brianc/node-postgres) |
| ws (`ws`) | 8.23.0 | Servidor WebSocket autenticado que recibe el flujo JPEG continuo de la XIAO. Se limita el tamaño de mensajes y se desactiva la compresión WebSocket. | MIT | [Código](https://github.com/websockets/ws) · [Licencia de la versión utilizada](https://github.com/websockets/ws/blob/8.23.0/LICENSE) |
| Sharp (`sharp`) | 0.35.5 | Lectura JPEG, giro, extracción de la zona seleccionada, redimensionado, RGB y miniaturas. | Apache-2.0 | [Documentación](https://sharp.pixelplumbing.com/) · [Código y licencia](https://github.com/lovell/sharp) |
| libvips y binarios asociados a Sharp | Dependencias resueltas en `package-lock.json`; `@img/sharp-libvips-linux-x64` 1.3.4 figura en el lockfile. | Motor nativo y bibliotecas de procesamiento de imágenes distribuidas con Sharp. | libvips: LGPL-2.1-or-later; el paquete binario indicado declara LGPL-3.0-or-later e incluye avisos de sus componentes. | [libvips](https://www.libvips.org/) · [Distribución de binarios de Sharp](https://github.com/lovell/sharp-libvips) |
| PGlite (`@electric-sql/pglite`) | 0.5.16, dependencia de desarrollo | Pruebas de esquema, consultas, transacciones y persistencia con PostgreSQL en WebAssembly. | Paquete npm: Apache-2.0; PostgreSQL incluido conserva la PostgreSQL License. | [PGlite](https://pglite.dev/) · [Código y licencias](https://github.com/electric-sql/pglite) |
| Node.js | 22.x; imagen `node:22-bookworm-slim` | Ejecución del servidor y herramientas del proyecto. Módulos incorporados: `node:http`, `node:crypto`, `node:fs`, `node:test`, `node:assert` y otros importados por el código. | MIT y avisos de componentes incluidos. | [API de Node.js](https://nodejs.org/api/) · [Licencias](https://github.com/nodejs/node/blob/main/LICENSE) |
| PostgreSQL | Versión del servicio administrado, consultable en Aiven | Motor de datos en Railway durante la primera etapa y en Aiven después de la migración. | PostgreSQL License | [Documentación](https://www.postgresql.org/docs/) · [Licencia](https://www.postgresql.org/about/licence/) |

Las versiones exactas de las dependencias npm directas y transitivas se conservan en [`software/src/servidor/package.json`](software/src/servidor/package.json) y [`software/src/servidor/package-lock.json`](software/src/servidor/package-lock.json). La instalación reproducible del contenedor usa `npm ci --omit=dev`. Las dependencias de terceros mantienen sus propias licencias y avisos; el lockfile permite identificar las versiones, pero no sustituye esos textos.

El servidor revisado usa HTTP nativo de Node.js. Los gráficos son SVG del proyecto y la tipografía usa fuentes del sistema. No se atribuyen a esta implementación Express, Chart.js, D3, Flask, OpenCV, NumPy, SQLite ni la fuente Archivo del esquema de ejemplo.

### Firmware y entorno ESP32

| Librería o componente | Versión identificada | Dónde se usa | Licencia | Sitio |
|---|---|---|---|---|
| Arduino core for ESP32 (`arduino-esp32`) | Familia 3.3.x indicada por el firmware; parche instalado no registrado | Compilación para XIAO ESP32-S3, funciones de Arduino, puerto serie, temporización y soporte de la placa. | LGPL-2.1-or-later para el núcleo; componentes incluidos conservan sus licencias. | [Repositorio](https://github.com/espressif/arduino-esp32) · [Licencia](https://github.com/espressif/arduino-esp32/blob/master/LICENSE.md) |
| WiFi (`WiFi.h`) | Incluida con Arduino-ESP32 | Modo estación, conexión a la red, reconexión y consulta de estado. | Distribuida dentro de Arduino-ESP32; consultar avisos de esa versión. | [API WiFi](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html) |
| ESP32 Camera (`esp_camera.h`) | Incluida en el entorno ESP32 instalado | Configuración de resolución y búferes, adquisición JPEG y ajustes del sensor. | Apache-2.0 | [esp32-camera](https://github.com/espressif/esp32-camera) |
| ESP-IDF: cliente HTTP (`esp_http_client.h`) y sistema (`esp_system.h`) | Versión integrada con el núcleo instalado | Solicitudes HTTPS, certificados, cabeceras, estado HTTP y generación del identificador de arranque. | ESP-IDF: Apache-2.0, con avisos de componentes de terceros. | [Cliente HTTP](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/protocols/esp_http_client.html) · [Licencia ESP-IDF](https://github.com/espressif/esp-idf/blob/master/LICENSE) |
| WebSockets (`WebSocketsClient.h`) | 2.7.2, Markus Sattler / Links2004 | Conexión WSS saliente autenticada para video continuo y mensajes de control/confirmación; se conserva validación TLS mediante CA. Se instala desde el gestor de bibliotecas de Arduino. | GNU LGPL 2.1; consultar los avisos de la distribución | [Repositorio](https://github.com/Links2004/arduinoWebSockets) · [Licencia de la versión utilizada](https://github.com/Links2004/arduinoWebSockets/blob/2.7.2/LICENSE) |
| Hora del sistema (`time.h`, `configTime`) | Incluida en el entorno de compilación | Sincronización NTP y comprobación de la hora para verificar certificados HTTPS. | Licencias del entorno y sus componentes. | [Hora del sistema en ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/system/system_time.html) |
| `capture-schedule.h` | Código del proyecto | Cálculo de la espera restante del ciclo de demostración y del modo estable. | Código propio; ver apartado de autoría. | [`software/src/firmware/XIAO_Remota/capture-schedule.h`](software/src/firmware/XIAO_Remota/capture-schedule.h) |

`Arduino.h`, `WiFi.h`, `WebSocketsClient.h`, `esp_camera.h`, `esp_http_client.h`, `esp_system.h` y `time.h` son los encabezados externos utilizados por el firmware revisado. `config.h`, `certificados.h` y `capture-schedule.h` son archivos de configuración o integración del proyecto; no son paquetes npm ni bibliotecas que deban buscarse por separado en el gestor de Arduino.

### API del navegador utilizadas, sin instalación de paquetes adicionales

| Recurso | Aplicación concreta | Fuente |
|---|---|---|
| Web Audio API (`AudioContext`, osciladores y ganancia) | Generación local de uno o dos tonos breves ante cambios confirmados. El usuario debe activar el sonido; no se descargaron ni generaron pistas de audio externas. | [Especificación publicada por W3C](https://www.w3.org/TR/webaudio/) |
| EventSource / Server-Sent Events | Avisos del servidor después de guardar mediciones y al modificar ajustes, con consulta HTTP de respaldo. | [HTML Living Standard: Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) |
| Fetch, AbortController y eventos de visibilidad | Consultas al servidor, cancelación de respuestas antiguas, coordinación de actualizaciones y recuperación del video al volver a la pestaña. | [Fetch Standard](https://fetch.spec.whatwg.org/) · [HTML: Page visibility](https://html.spec.whatwg.org/multipage/interaction.html#page-visibility) |
| DOM, SVG, CSS e Intl.DateTimeFormat | Editor de zona, gráficos propios, mapa de registros, temas y casillas horarias. Las horas se presentan en la zona local del navegador, con distinción de horas repetidas por cambios de horario. | [DOM Standard](https://dom.spec.whatwg.org/) · [SVG de MDN](https://developer.mozilla.org/en-US/docs/Web/SVG) · [ECMA-402](https://tc39.es/ecma402/) |

Estas API forman parte del navegador. El monitor no añade Chart.js, D3, una biblioteca de gráficos ni un servicio externo de notificaciones para estas funciones.

### Teachable Machine y recursos del modelo

| Recurso | Origen | Identificación y uso |
|---|---|---|
| Entrenador de imágenes | [Teachable Machine, Google Creative Lab](https://teachablemachine.withgoogle.com/) | Herramienta con la que se entrenaron las categorías del proyecto y se exportó el modelo para TensorFlow.js. |
| Base preentrenada MobileNet | TensorFlow y biblioteca de imágenes de Teachable Machine. [Código de integración](https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image/src). | Base de extracción de características para el entrenamiento por transferencia. Se conserva la atribución Apache-2.0 correspondiente. |
| `@teachablemachine/image` | [Biblioteca y ejemplos oficiales](https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image), Apache-2.0 | Referencia para la integración inicial en navegador y procedencia del modelo exportado. No es una dependencia npm directa del servidor actual. |
| `model.json`, `metadata.json` y `weights.bin` | Exportación del entrenamiento del proyecto | Arquitectura, etiquetas/metadatos y pesos; ubicados en `software/src/servidor/model/`. |
| Metadatos de la exportación | `software/src/servidor/model/metadata.json` | Nombre: `1er entrenamiento`; `tmVersion`: 2.4.17; `packageVersion`: 0.8.4-alpha2; `tfjsVersion`: 1.7.4; tamaño de entrada: 224. La fecha registrada es 3 de octubre de 2026. |

Los números de versión contenidos en `metadata.json` describen la exportación. La versión de TensorFlow.js instalada y usada por el servidor es **4.22.0**. La inferencia actual se realiza en Railway; la XIAO no ejecuta un modelo TensorFlow Lite ni el navegador realiza el análisis principal de esta versión.

## Uso de Inteligencia Artificial

### Herramientas, alcance y registro de las solicitudes

Se utilizó **ChatGPT/Codex de OpenAI** como asistencia durante el desarrollo para proponer soluciones, generar y modificar código, explicar su funcionamiento, depurar errores, elaborar pruebas y redactar documentación. Referencias de las herramientas: [ChatGPT](https://chatgpt.com/) y [Codex](https://openai.com/codex/).

La asistencia se aplicó tanto al prototipo local como a la arquitectura remota documentada en este archivo. El registro corresponde a las conversaciones de desarrollo mantenidas hasta el **22 de noviembre de 2026**. No se dispone de una identificación verificable del modelo de IA y de la fecha exacta de cada intervención, por lo que no se asignan versiones como GPT-4o a usos que no están documentados. El único uso de Claude es la organización del repositorio de entrega (punto 19).

Los **prompts utilizados** que siguen son resúmenes fieles de solicitudes reales del chat, con la redacción normalizada; no se presentan como transcripciones literales. Las modificaciones se desarrollaron en varias iteraciones a partir de las pruebas y observaciones del usuario. Los archivos y funciones indicados permiten localizar la implementación revisada sin depender de números de línea que cambian al editar el código.

### 1. Preparación del entrenamiento y diseño de la arquitectura

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Explicar cómo entrenar el detector con Teachable Machine, cuántos objetos y fotografías utilizar y cómo acceder al sistema desde otra red.
- **Uso y adaptación:** Se orientó la preparación de las cuatro clases y la variedad de posiciones e iluminación. Se discutió el procesamiento en el navegador y luego se adaptó el sistema para que Railway ejecutara el modelo y el monitor pudiera consultarse desde Internet.
- **Ubicación:** `software/src/servidor/model/`, `software/src/servidor/lib/model.js` y `README.md`.
- **Comprensión del funcionamiento:** Teachable Machine ajusta un clasificador a partir de ejemplos etiquetados. En la versión remota, la XIAO envía imágenes y el servidor obtiene las puntuaciones; abrir o cerrar la página no controla la ejecución del análisis.

### 2. Firmware, conexión WiFi y envío de fotografías

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Hacer que la XIAO se conecte a una red existente para mejorar la estabilidad, proporcionar el código y resolver los errores de conexión y del monitor serie.
- **Uso y adaptación:** Se desarrolló y corrigió el firmware de captura y envío, con configuración privada en `config.h`, reconexión WiFi, sincronización NTP, verificación HTTPS y registros serie. Durante la depuración se trataron, entre otros, el uso de `now` fuera de su ámbito y la conexión mediante Internet compartido desde un iPhone.
- **Ubicación:** `software/src/firmware/XIAO_Remota/XIAO_Remota.ino`, especialmente `setup()`, `loop()`, `initCamera()` y `sendPhoto()`.
- **Comprensión del funcionamiento:** `setup()` configura la placa y la red; `loop()` comprueba conectividad y planificación antes de capturar. `sendPhoto()` envía el JPEG con el token de la cámara y comprueba la respuesta HTTP. La hora sincronizada permite verificar la vigencia de los certificados.

### 3. Integración del modelo y preparación de la imagen

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Explicar cómo se carga el modelo y adaptar el análisis para que funcione en el servidor remoto.
- **Uso y adaptación:** Se integró la exportación de Teachable Machine con TensorFlow.js en Node.js y Sharp. Se añadieron carga de pesos desde los archivos del proyecto, preparación de RGB, redimensionado a 224 × 224 y miniatura para el monitor.
- **Ubicación:** `software/src/servidor/lib/model.js`: `loadModel()`, `classify()`, `prepareImage()` y `predictRGB()`.
- **Comprensión del funcionamiento:** La arquitectura y los pesos se cargan una vez y se reutilizan. Cada foto se orienta y recorta antes de convertirse en el tensor de entrada. La salida contiene una puntuación por clase; la liberación de tensores evita acumular memoria entre inferencias.

### 4. Suma de clases, promedio móvil y confirmación de la conclusión

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Sumar las clases Botellas, Papeles y Cartones y Bolsas para decidir si hay basura, aunque cambie la clase dominante, y aclarar el significado del promedio y de las confirmaciones.
- **Uso y adaptación:** Se desarrolló una decisión conjunta basada en la suma de residuos, una ventana móvil y evaluaciones consecutivas. Se ajustó la visualización para distinguir la puntuación de la última captura, el promedio y la confianza asociada a una conclusión confirmada.
- **Ubicación:** `software/src/servidor/lib/decision.js`: `decisionPolicy()`, `decide()` y `publicState()`; presentación en `software/src/servidor/public/app.js`.
- **Comprensión del funcionamiento:** Primero se suman las tres clases de basura de cada captura y después se promedian las sumas recientes. Con un umbral de 80 %, un promedio de al menos 80 % apoya Hay basura y uno de hasta 20 % apoya Sin basura. La confirmación exige evaluaciones consecutivas del mismo candidato; entre los límites se obtiene No seguro. Las ventanas de esas evaluaciones se superponen.

### 5. Alojamiento remoto, PostgreSQL y migración a Aiven

- **Herramienta:** ChatGPT/Codex, con operaciones autorizadas mediante las integraciones de GitHub y Railway.
- **Prompt utilizado (resumen):** Trasladar el sistema a Railway y PostgreSQL, desplegar desde GitHub, guardar las mediciones y luego llevar la base de datos a Aiven.
- **Uso y adaptación:** Se prepararon el servidor, el contenedor, el esquema y las consultas, además de instrucciones de despliegue, exportación e importación y el script de copia entre bases. Se depuraron fallos de inicio y conexión, incluida la resolución del host de Aiven.
- **Ubicación:** `software/src/servidor/server.js`, `software/src/servidor/Dockerfile`, `software/src/servidor/lib/database.js`, `software/src/servidor/lib/store.js`, `software/src/servidor/database/schema.sql` y `software/src/servidor/scripts/copy-to-aiven.js`.
- **Comprensión del funcionamiento:** Railway ejecuta el servidor y Aiven aloja los datos. Las consultas parametrizadas transportan valores separados del SQL; las transacciones agrupan operaciones que deben confirmarse juntas. La copia del historial conserva los registros previos en lugar de regenerarlos con la configuración nueva.

### 6. Acceso público, administración y protección de ajustes

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Hacer pública la página, quitar la descarga de la base y permitir que solo el administrador cambie la rotación y la exigencia de conclusión.
- **Uso y adaptación:** Se separaron las consultas públicas de las escrituras administrativas. Se retiró la descarga pública; posteriormente se incorporó una exportación reservada al administrador. Se desarrollaron sesiones privadas, cierre de sesión, cookies protegidas, comprobación de origen, token CSRF y validación de los ajustes en el servidor.
- **Ubicación:** `software/src/servidor/lib/admin-auth.js`, `software/src/servidor/api/admin.js`, `software/src/servidor/api/export.js`, `software/src/servidor/public/admin.js` y `software/src/servidor/public/admin.html`.
- **Comprensión del funcionamiento:** Ocultar un botón no impide que alguien llame directamente a una API. Por eso el servidor comprueba la sesión y los requisitos de cada escritura. El token usado por la cámara para enviar fotografías no otorga permisos de administrador.

### 7. Giro y zona de análisis ajustable

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Adaptar el giro al montaje de la cámara y añadir una zona de análisis que exclusivamente el administrador pueda modificar.
- **Uso y adaptación:** Se incorporaron orientación de 0° o 180°, edición de un recorte cuadrado, persistencia en PostgreSQL y control de versión para descartar resultados calculados con ajustes anteriores.
- **Ubicación:** `software/src/servidor/public/roi-editor.js`, `software/src/servidor/public/roi-geometry.js`, `software/src/servidor/public/admin.js`, `software/src/servidor/api/admin.js` y `software/src/servidor/lib/model.js`.
- **Comprensión del funcionamiento:** La imagen se gira antes de recortar. La zona se expresa con un centro y un tamaño relativos para que el editor y la inferencia usen la misma geometría. Cambiar estos ajustes reinicia la ventana de decisión en la siguiente captura y conserva el historial anterior.

### 8. Avance de decisión y agrupación de las barras de residuos

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Mostrar el avance de la decisión y reunir Botellas, Papeles y Cartones y Bolsas en una sola barra llamada Hay basura.
- **Uso y adaptación:** Se añadieron contadores separados de capturas mínimas y confirmaciones, mensajes según el estado real y una barra conjunta para las tres clases de residuos.
- **Ubicación:** `software/src/servidor/public/decision-progress.js`, `software/src/servidor/public/app.js` y `software/src/servidor/public/index.html`.
- **Comprensión del funcionamiento:** Los contadores avanzan al recibir mediciones válidas, no al pasar el tiempo o recargar la página. La barra de Hay basura suma puntuaciones de una misma imagen; el avance de confirmaciones es un contador y no un porcentaje de exactitud del modelo.

### 9. Gráficos, fecha y navegación manual del historial

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Crear gráficos en tiempo real, mostrar escalones entre Hay basura y Sin basura, elegir una fecha, recorrer sus 24 horas y ajustar libremente el intervalo arrastrando los extremos del recuadro azul.
- **Uso y adaptación:** Se implementaron gráficos SVG propios, intervalos rápidos, barras sincronizadas, mapa diario de mediciones y agarres de inicio y final. Se corrigió la desaparición de las marcas al desplazarse rápido; el mapa conserva su propia consulta y los detalles se cargan al terminar el ajuste.
- **Ubicación:** `software/src/servidor/public/charts.js`, `software/src/servidor/public/chart-data.js`, `software/src/servidor/public/chart-overview.js`, `software/src/servidor/public/charts.css`, `software/src/servidor/api/chart-history.js` y `software/src/servidor/api/chart-coverage.js`.
- **Comprensión del funcionamiento:** El mapa verde indica dónde existen registros y el recuadro azul delimita el intervalo de ambos gráficos. Cada extremo cambia un límite manteniendo el contrario. Los huecos o resultados No seguro no se dibujan como Sin basura, y las consultas respetan la fecha local y sus cambios de hora.

### 10. Cadencia de demostración y actualización de la página

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Reducir la demora entre captura y decisión para una demostración en vivo y conservar el método anterior para poder volver atrás.
- **Uso y adaptación:** Se creó el perfil demo con promedio de hasta 3 capturas y 2 confirmaciones y un ciclo objetivo de captura de 5 s. Se añadieron avisos SSE después de guardar los registros y consultas de respaldo si se pierde ese canal. El método estable previo quedó documentado y respaldado.
- **Ubicación:** `software/src/firmware/XIAO_Remota/capture-schedule.h`, `software/src/servidor/lib/decision.js`, `software/src/servidor/lib/live-events.js`, `software/src/servidor/public/app.js` y `software/docs/MODO_DEMO_Y_REVERSION.md`.
- **Comprensión del funcionamiento:** La espera del modo demo descuenta el tiempo empleado en capturar, enviar y recibir la respuesta; si una operación tarda más, no puede garantizarse un ciclo de 5 s. Cada captura actualiza un promedio. En condiciones ideales, con evidencia consistente desde el principio, la primera conclusión demo puede confirmarse en la cuarta captura, aproximadamente 15 s después de la primera.

### 11. Diseño visual y temas claro y oscuro

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Mejorar la estética de la página y añadir un tema claro y otro oscuro.
- **Uso y adaptación:** Se revisaron jerarquía visual, tarjetas, controles, colores y comportamiento adaptable. Se implementó una elección de tema compartida por monitor y administración, guardada en el navegador y aplicada también a los gráficos.
- **Ubicación:** `software/src/servidor/public/theme.js`, `style.css`, `charts.css`, `admin.css`, `index.html` y `admin.html`.
- **Comprensión del funcionamiento:** Las variables CSS determinan la paleta. El tema inicial considera la preferencia del dispositivo y después utiliza la elección guardada en `localStorage`; cambiar la apariencia no modifica los registros ni la configuración de detección.

### 12. Pruebas, depuración y documentación de la entrega

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Entregar código comentado y estructurado, explicar librerías y funciones, corregir los problemas observados y completar `FUENTES.md` con lo utilizado durante el proyecto.
- **Uso y adaptación:** Se generaron y revisaron pruebas para reglas, API, base de datos, seguridad, imágenes e interacciones. Se elaboraron el README, la explicación del funcionamiento, las instrucciones de operación y reversión y este registro de fuentes. Las respuestas se ajustaron al código y a las observaciones del usuario.
- **Ubicación:** `software/src/servidor/test/`, `README.md`, `software/docs/MODO_DEMO_Y_REVERSION.md` y `FUENTES.md`.
- **Comprensión y verificación:** La revisión de software indicada al comienzo de este archivo completó 82 pruebas automatizadas satisfactorias en Node.js 22 durante la mejora del dashboard. Incluyen reglas, permisos, persistencia, exportaciones, pausa, canal de video, zona de análisis, gráficos, alertas y tendencias. También se comprobó la página pública desplegada en Railway, la consulta de tendencias y la navegación desde una casilla horaria al gráfico correspondiente. La verificación anterior de los extremos del intervalo y la sincronización de los gráficos se conserva como antecedente. Esas comprobaciones validan comportamientos del software; no constituyen una evaluación de exactitud del clasificador sobre un conjunto independiente.

### 13. Pausa y reanudación de capturas y análisis

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Añadir al modo administrador un botón para pausar y continuar la captura y el análisis, y aclarar qué ocurre físicamente en la XIAO.
- **Uso y adaptación:** Se añadió `capturas_pausadas` a la configuración persistente, control de versión, protección administrativa, rechazo temprano de la ingesta pausada y comprobación al guardar para no incorporar una inferencia iniciada antes de la pausa. El firmware consulta y reconoce órdenes de control; estando pausado y sin video solicitado desinicializa la cámara. Al reanudar se inicia una ventana de decisión nueva.
- **Ubicación:** `software/src/servidor/api/operations.js`, `software/src/servidor/api/ingest.js`, `software/src/servidor/lib/store.js`, `software/src/servidor/lib/device-status.js`, `software/src/servidor/public/admin-tools.js`, `software/src/servidor/database/schema.sql` y `software/src/firmware/XIAO_Remota/XIAO_Remota.ino`.
- **Comprensión y verificación:** Pausar el análisis en el servidor y detener capturas físicas son acciones coordinadas pero distintas. Para detener las capturas normales en la placa se necesita firmware compatible; una imagen ya iniciada puede estar en tránsito al ordenar la pausa. Los cuadros de video solicitados por el administrador constituyen un canal aparte y pueden seguir capturándose con la detección pausada. El historial se conserva.

### 14. Exportación privada de la base de datos

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Recuperar opciones de exportación de la base exclusivamente en administración, manteniendo pública la consulta del monitor.
- **Uso y adaptación:** Se implementaron JSON con `camaras`, `estado_camara` y `mediciones`, y CSV de `mediciones`, para todo el historial o un rango de fechas. Se usa una transacción de solo lectura `REPEATABLE READ`, cursor por identificador y lotes de 500 filas. La entrega respeta la capacidad de escritura del flujo HTTP, admite cancelación, limita la duración a dos minutos y permite una exportación simultánea por instancia.
- **Ubicación:** `software/src/servidor/lib/database-export.js`, `software/src/servidor/api/admin-export.js`, `software/src/servidor/public/admin-tools.js`, `software/src/servidor/test/admin-export.test.js` y `software/src/servidor/test/admin-operations.test.js`.
- **Comprensión y verificación:** La sesión se comprueba antes y durante la entrega. El intervalo filtra las mediciones; el JSON también incluye los ajustes y el estado operativo de la misma lectura consistente. El archivo exportado contiene datos del proyecto, no las contraseñas ni variables de entorno. Esta exportación lógica no es un volcado completo de PostgreSQL con usuarios, permisos, DDL y todos los objetos del servicio.

### 15. Video continuo privado e integración con la zona de análisis

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Incorporar video real para posicionar la cámara, mostrarlo en el mismo recuadro donde se ajusta la zona de análisis y evitar tener que reactivarlo al mover la ventana entre pantallas.
- **Uso y adaptación:** La solución inicial de fotografías espaciadas se sustituyó por JPEG continuos: WSS de la XIAO al servidor y MJPEG del servidor al navegador con sesión administrativa. Se incorporaron `ws` 8.23.0 y WebSockets 2.7.2 de Markus Sattler. El objetivo de video es 320 × 240 a 12 fps, sujeto a la red; las fotos para inferencia conservan 800 × 600. Se limitan los cuadros pendientes para no acumular una cola antigua. El recuadro de edición presenta el video con el giro seleccionado y superpone la misma geometría de zona que utiliza la inferencia.
- **Ubicación:** `software/src/firmware/XIAO_Remota/XIAO_Remota.ino`, `LEEME.md`, `software/src/servidor/lib/device-video.js`, `software/src/servidor/lib/live-preview.js`, `software/src/servidor/api/live-preview.js`, `software/src/servidor/public/admin-live.js`, `admin.js`, `admin.html` y `roi-editor.js`.
- **Comprensión y verificación:** Es video MJPEG, no un enlace WebRTC ni una grabación. Los cuadros se retransmiten en memoria y no se insertan como mediciones ni se guardan como un historial de video. La autorización temporal se renueva cada 5 s, vence si no se renueva en 15 s y tiene un máximo de 5 minutos por activación. Se mantiene la intención de reproducción ante cambios breves de visibilidad y se reconecta al recuperar foco; cerrar sesión o abandonar la página detiene el acceso. Las pruebas automatizadas validan transporte, permisos y recuperación; no certifican 12 fps ni una latencia física garantizada en todas las redes.

### 16. Dashboard de decisión, colores y alertas

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Mejorar el dashboard en vivo para apoyar la toma de decisiones con alertas y colores claros para Hay basura, Sin basura y estados sin confirmar.
- **Uso y adaptación:** Se añadieron estado rojo para basura, verde para sin basura, amarillo para evaluación en curso y presentación neutra para pausa, espera o falta de datos. Se incorporaron acción sugerida, hora de la última medición y etiqueta de actualización. Un aviso de 8 s destaca nuevas confirmaciones o cambios; el sonido opcional, inicialmente desactivado, genera dos tonos para basura y uno para sin basura mediante Web Audio API.
- **Ubicación:** `software/src/servidor/public/dashboard-data.js`, `dashboard-live.js`, `dashboard.css`, `app.js`, `index.html` y `software/src/servidor/test/dashboard-ui.test.js`.
- **Comprensión y verificación:** Los colores y avisos usan la conclusión confirmada del servidor. No se emiten avisos por cada captura idéntica, al abrir la página con un estado ya confirmado ni al regresar al mismo resultado después de una incertidumbre. La confianza de Hay basura es el promedio de basura; para Sin basura es su complemento. Los avisos son locales a la página visible y no envían correo ni notificaciones externas. Esta mejora no cambió los umbrales ni la matemática del modelo.

### 17. Tendencias horarias y últimos cambios de conclusión

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Añadir un apartado de tendencias de horas de concentración de Hay basura frente a Sin basura, integrado con las fechas y gráficos existentes.
- **Uso y adaptación:** Se añadieron una consulta SQL de solo lectura, el resumen de las tres conclusiones del día, casillas horarias con barra apilada y una lista de hasta ocho confirmaciones o cambios. La hora destacada es la que acumula más registros Hay basura; en empate se considera su proporción y luego la hora más temprana. Pulsar una casilla enfoca esa hora en los dos gráficos. La fecha es compartida con el selector existente y el resumen abarca el día completo, independientemente del zoom.
- **Ubicación:** `software/src/servidor/lib/store.js` (`readDecisionTrends`), `software/src/servidor/api/decision-trends.js`, `software/src/servidor/public/decision-trends.js`, `dashboard-data.js`, `software/src/servidor/test/decision-trends.test.js` y `dashboard-ui.test.js`.
- **Comprensión y verificación:** Cada porcentaje usa el número de mediciones de su período como denominador, incluyendo No seguro. No estima duración, masa, volumen ni porcentaje de la imagen ocupado por residuos. Sin datos no equivale a Sin basura. La consulta usa un único snapshot, parámetros y un intervalo acotado; se probaron más de 6000 registros y días de 23/25 horas. Se cancelan consultas obsoletas al cambiar de fecha y los datos nuevos no reemplazan una fecha histórica seleccionada. La lista separa cambios de resultado y confirmaciones después de una interrupción de más de 90 s.

### 18. Documentación del diseño 3D, materiales y fuentes

- **Herramienta:** ChatGPT/Codex.
- **Prompt utilizado (resumen):** Completar la documentación con las vistas del ensamble y el plano enviado por el equipo, elaborar un BOM dejando vacíos los precios desconocidos y actualizar FUENTES.md con todo el desarrollo y los modelos 3D.
- **Uso y adaptación:** Se organizaron seis vistas CAD y el plano LA CARCASA; se documentaron dimensiones, componentes, fuentes de GrabCAD y datos pendientes. Se elaboraron README de diseño y BOM en Markdown, CSV y una versión para Excel, ajustando su formato a lo solicitado. Esta actualización incorpora también pausa, exportaciones, video y dashboard.
- **Ubicación:** `diseno_3d/README.md`, `diseno_3d/planos/LA CARCASA - Blueprint.pdf`, `hardware/bom/BOM.md`, `hardware/bom/BOM.csv` y este `FUENTES.md`.
- **Comprensión y verificación:** La asistencia organizó información aportada y revisó su coherencia con el código. No creó el modelo CAD ni realizó una impresión, medición física o validación de interferencias. Se atribuye el plano a su autor indicado y los modelos importados a sus fuentes; precios, tolerancias no documentadas, licencias y detalles de fabricación desconocidos se dejan para completar por el equipo.

### 19. Organización del repositorio de entrega

- **Herramienta:** Claude (Anthropic), 22 de noviembre de 2026.
- **Uso:** reorganizar el repositorio de entrega según la pauta del Avance #3 y el repositorio de ejemplo del curso: README principal y de cada carpeta, protocolo de pruebas, BOM con precios de referencia e integración del código del repositorio de despliegue en `software/src/`.
- **Adaptación:** los datos (problema, medidas, componentes, código y resultados) provienen del equipo y del código desarrollado con ChatGPT/Codex; Claude no modificó el código del servidor ni del firmware.

### Aprendizaje automático integrado en el dispositivo

Además de la asistencia generativa anterior, el proyecto utiliza **Teachable Machine y TensorFlow.js** para su función de detección. Teachable Machine se empleó para entrenar el modelo con las clases del proyecto y TensorFlow.js para ejecutarlo. La base MobileNet, las bibliotecas y los archivos exportados se atribuyen en las secciones de código y librerías de este documento. El dispositivo completo utiliza IA, aunque la inferencia de la versión actual se realice en Railway.

Las explicaciones de comprensión describen cómo funciona la implementación y sirven de apoyo para su defensa. Cada integrante debe poder explicar el código y las decisiones de diseño; este registro no certifica por sí solo la comprensión individual. La autoría del código asistido y la procedencia de sus componentes se declaran de forma explícita.

## Diseño 3D propio, plano y evidencias del ensamble

### Carcasa desarrollada por el equipo

| Recurso | Autor u origen documentado | Uso y adaptación en el proyecto |
|---|---|---|
| Carcasa LA CARCASA, cuerpos C. Inferior y C. Superior | Diseño del equipo en Autodesk Fusion. El plano identifica a **Matías Armijo H.** como creador y lleva fecha **16-11-26**. | Encapsulado de dos mitades que organiza la placa con cámara, batería, interruptor y cableado. Integra abertura de la lente, acceso USB-C, acceso lateral al interruptor, alojamientos/apoyos internos y ranuras laterales. La autoría de la carcasa se diferencia de los modelos comerciales importados. |
| Plano técnico LA CARCASA | PDF de una hoja proporcionado por el equipo; escala indicada **1,5:1**. | Referencia de cotas y forma exterior. Se registran las dimensiones del plano, sin deducir medidas de las imágenes. |
| Seis capturas de Autodesk Fusion | Imágenes enviadas por el equipo el 21 de noviembre de 2026. | Evidencia del ensamble: vista superior, conjunto cerrado/transparente, interior sin tapa, frente USB-C, lateral y vista desmontada. Son capturas CAD, no fotografías de una pieza fabricada ni renders realizados por IA. |
| README de diseño 3D | Documento preparado con asistencia de ChatGPT a partir del plano y las capturas. | Describe integración, accesos, plano, fuentes, fabricación pendiente y comprobaciones del montaje. |

### Datos transcritos del plano

| Dato | Valor documentado |
|---|---|
| Largo × ancho máximo × alto del cuerpo | **77 × 58 × 30 mm** |
| División en altura | **15 mm + 15 mm** |
| Cara plana del perfil frontal | **38 mm**; distinta del ancho máximo de 58 mm |
| Tolerancias generales indicadas | **ISO 2768-c**, tal como figura en el plano |
| Tolerancia de atornillado indicada | **0,10 mm**; falta precisar su aplicación y validar el ajuste físico |
| Autor y fecha del plano | **Matías Armijo H., 16 de noviembre de 2026** |

Estas cotas describen el cuerpo y el plano aportado; no se añaden medidas para salientes de la lente ni se afirma que una pieza fabricada cumpla las tolerancias sin una medición. La referencia a ISO 2768-c reproduce la indicación del plano, no certifica cumplimiento.

### Identificación de las vistas en la documentación de diseño

| Ruta interna documentada | Vista y finalidad |
|---|---|
| `diseno_3d/renders/fusion/06_ensamble_completo.jpg` | Conjunto cerrado con transparencia para observar la integración. |
| `diseno_3d/renders/fusion/01_interior_sin_tapa.jpg` | Disposición de batería, placa y cámara. |
| `diseno_3d/renders/fusion/02_vista_frontal_usb.jpg` | Acceso al USB-C y división de las mitades. |
| `diseno_3d/renders/fusion/03_vista_lateral.jpg` | Alturas, ventilación, cableado y colocación de componentes. |
| `diseno_3d/renders/fusion/04_componentes_fuera_de_carcasa.jpg` | Separación visual de carcasa y componentes internos. |
| `diseno_3d/renders/fusion/05_vista_superior.jpg` | Distribución en planta, lente, interruptor y alojamientos. |
| `diseno_3d/planos/LA CARCASA - Blueprint.pdf` | Plano técnico de una hoja con cotas, escala y cajetín. |
| `diseno_3d/fusion360/Presentacion 3/LA CARCASA (f3d).f3z` | Archivo nativo de Fusion 360 con el ensamble completo; `LA CARCASA (stl).stl` es la exportación para imprimir. |
| `hardware/fotos/` | Fotografías de la carcasa impresa, con insertos de bronce, apertura con destornillador y montaje en trípode. |

La carcasa se imprimió en PLA en dos mitades unidas con tornillos sobre insertos roscados de bronce (ver `hardware/fotos/`). No se atribuyen a las capturas propiedades como estanqueidad, grado IP, resistencia o rendimiento térmico.

## Modelos 3D de terceros

Se utilizaron los siguientes modelos de terceros como referencias geométricas de los componentes del proyecto:

| Elemento | Origen | Uso |
|---|---|---|
| Seeed Studio XIAO ESP32-S3 Sense | [Modelo en GrabCAD](https://grabcad.com/library/seeed-studio-xiao-esp32s3-sense-1) | Representación 3D de la placa y el módulo de cámara para su integración en el diseño del soporte o carcasa. |
| Batería 523450, 1000 mAh y 3,7 Wh según la denominación de la publicación | [Modelo en GrabCAD](https://grabcad.com/library/523450-li-iron-battery-1000mah-3-7wh-dc4-2v-1) | Referencia geométrica para representar la batería y distribuir el espacio destinado a ella en el diseño. |
| Interruptor deslizante SS12D00 | [Modelo en GrabCAD](https://grabcad.com/library/ss12d00-1) | Representación 3D del interruptor para su ubicación y espacio de montaje. |
| Disipador | Componente denominado Disipador en el navegador del ensamble Fusion aportado. | Referencia dentro de la integración de la electrónica. Volumen referencial; procedencia no registrada. |

Los enlaces de origen fueron proporcionados por el equipo. Los modelos corresponden a sus autores originales. La consulta de las tres publicaciones el 22 de noviembre de 2026 devolvió acceso denegado (HTTP 403); por eso esos datos no se inventan ni se asigna una licencia genérica a los modelos. Su uso documentado es como referencia geométrica para posicionar componentes y prever aberturas; no se dispone de un registro verificable de modificaciones a sus mallas o sólidos. Las especificaciones de la batería indicadas arriba identifican el modelo descargado y no certifican por sí solas las características de la batería física utilizada.

## Datasheets y documentación técnica consultada

Las referencias siguientes respaldan la implementación o las instrucciones utilizadas durante el desarrollo. Se incluyen documentación de fabricantes, proyectos originales y API oficiales; la lista se actualiza al 22 de noviembre de 2026. Las referencias añadidas para video, audio y diseño se distinguen por su aplicación concreta.

### Placa, cámara, red y firmware

| Documento | Autor u organización | Aplicación en el proyecto |
|---|---|---|
| [Getting Started with Seeed Studio XIAO ESP32-S3 Series](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) | Seeed Studio | Identificación de la placa y configuración del entorno Arduino. |
| [Camera Usage for Sense Version](https://wiki.seeedstudio.com/xiao_esp32s3_camera_usage/) | Seeed Studio | Pines, inicialización, PSRAM y captura con la cámara Sense. |
| [OV3660 datasheet, copia publicada por Seeed Studio](https://files.seeedstudio.com/wiki/SeeedStudio-XIAO-ESP32S3/res/OV3660_datasheet.pdf) | OmniVision; distribución en la documentación de Seeed Studio | Referencia técnica del sensor OV3660 utilizado por el proyecto. |
| [ESP32-S3 Series Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf) | Espressif Systems | Características del microcontrolador y conectividad. |
| [Controlador y ejemplos ESP32 Camera](https://github.com/espressif/esp32-camera) | Espressif Systems | Manejo de JPEG, búferes, sensor y adquisición de cuadros. |
| [Wi-Fi API de Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html) | Espressif Systems | Diferencia entre AP y STA y conexión a una red existente. |
| [ESP HTTP Client](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/protocols/esp_http_client.html) | Espressif Systems | Envío POST de fotografías, certificados TLS y tratamiento de respuestas. |
| [WebSockets para Arduino](https://github.com/Links2004/arduinoWebSockets/tree/2.7.2) | Markus Sattler / Links2004 y colaboradores | Cliente WSS del firmware y API de conexión con CA para video continuo. |
| [System Time](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/system/system_time.html) | Espressif Systems | Hora del sistema y sincronización antes de HTTPS. El firmware usa `pool.ntp.org` y `time.google.com`. |

### Entrenamiento, imágenes e inferencia

| Documento | Autor u organización | Aplicación en el proyecto |
|---|---|---|
| [Teachable Machine](https://teachablemachine.withgoogle.com/) y [biblioteca de imágenes](https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image) | Google Creative Lab | Entrenamiento por categorías, exportación y ejemplos de predicción. |
| [Save and load models](https://www.tensorflow.org/js/guide/save_load) | TensorFlow | Lectura de arquitectura y pesos y carga del modelo mediante TensorFlow.js. |
| [Platforms and environments](https://www.tensorflow.org/js/guide/platform_environment) | TensorFlow | Diferencia entre ejecución en navegador y Node.js y elección de backend. |
| [Documentación de Sharp](https://sharp.pixelplumbing.com/) | Proyecto Sharp | Rotación, recorte, redimensionado y conversión de la imagen antes del análisis. |

### Servidor, despliegue, persistencia y exportación

| Documento | Autor u organización | Aplicación en el proyecto |
|---|---|---|
| [ws](https://github.com/websockets/ws/tree/8.23.0) | Proyecto websockets/ws y colaboradores | Recepción de cuadros binarios y control del canal de video del dispositivo. |
| [API de Node.js](https://nodejs.org/api/) | Proyecto Node.js | Servidor HTTP, archivos, criptografía, variables de entorno y pruebas. |
| [Dockerfile reference](https://docs.docker.com/reference/dockerfile/) | Docker | Construcción de la imagen del servicio y ejecución con un usuario sin privilegios. |
| [Dockerfiles en Railway](https://docs.railway.com/builds/dockerfiles) | Railway | Despliegue del directorio `software/src/servidor/` mediante su Dockerfile. |
| [Controlling GitHub Autodeploys](https://docs.railway.com/deployments/github-autodeploys) | Railway | Actualización automática del servicio al integrar cambios en la rama conectada. |
| [Healthchecks](https://docs.railway.com/deployments/healthchecks) | Railway | Comprobación de que el servidor está preparado antes de activar un despliegue. |
| [PostgreSQL Documentation](https://www.postgresql.org/docs/) | PostgreSQL Global Development Group | Tablas, restricciones, transacciones, consultas e índices. |
| [Window Functions](https://www.postgresql.org/docs/current/functions-window.html) y [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | PostgreSQL Global Development Group | Detección de cambios con `lag()`, agregados horarios y exportación consistente con `REPEATABLE READ`. |
| [JSON Functions and Operators](https://www.postgresql.org/docs/current/functions-json.html) | PostgreSQL Global Development Group | JSONB en ajustes y preparación de exportaciones de datos. |
| [node-postgres: SSL](https://node-postgres.com/features/ssl) | Proyecto node-postgres | Configuración de TLS y CA al conectar el servidor con Aiven. |
| [Aiven for PostgreSQL](https://aiven.io/docs/products/postgresql) | Aiven | Administración y conexión a la base remota. |
| [TLS/SSL certificates](https://aiven.io/docs/platform/concepts/tls-ssl-certificates) | Aiven | Certificado CA del proyecto y verificación de la conexión. |
| [Write and run queries in PG Studio](https://aiven.io/docs/products/postgresql/howto/pg-studio/write-run-queries) | Aiven | Consulta del historial, comprobación de conteos y exportación de resultados desde SQL editor. |
| [Connect to Aiven with DBeaver](https://aiven.io/docs/products/postgresql/howto/connect-dbeaver) y [Data export](https://dbeaver.com/docs/dbeaver/Data-export/) | Aiven y DBeaver | Alternativa explicada para exportar tablas directamente a JSON. Su instalación o uso efectivo no están confirmados. |

### Interfaz web, interacción y seguridad

| Documento | Autor u organización | Aplicación en el proyecto |
|---|---|---|
| [SVG](https://developer.mozilla.org/en-US/docs/Web/SVG) | MDN Web Docs | Gráficos de probabilidad y escalones y mapa diario de registros. |
| [Web Audio API](https://www.w3.org/TR/webaudio/) | W3C | Referencia de la API de audio usada para sintetizar tonos locales tras activar el sonido. |
| [WebSockets Standard](https://websockets.spec.whatwg.org/) | WHATWG | Referencia del transporte continuo WebSocket; el proyecto lo usa para el enlace de la placa al servidor mediante las bibliotecas citadas. |
| [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) | MDN Web Docs | Avisos del servidor después de guardar nuevas mediciones. |
| [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) y [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) | MDN Web Docs | Solicitudes del monitor y cancelación de consultas al cambiar de intervalo. |
| [setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) | MDN Web Docs | Arrastre de la zona de análisis y de los extremos de la ventana temporal. |
| [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) y [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) | MDN Web Docs | Preferencia de tema claro y oscuro y conservación de la elección. |
| [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) | MDN Web Docs | Cookies administrativas con atributos Secure, HttpOnly y SameSite. |
| [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | OWASP | Referencia para proteger cambios administrativos mediante token CSRF y comprobación de origen. |
| [Ignoring files](https://docs.github.com/en/get-started/git-basics/ignoring-files) y [Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) | GitHub | Exclusión de claves y tratamiento de credenciales publicadas por error. |
| [Certificados de ISRG / Let's Encrypt](https://letsencrypt.org/certificates/), [Google Trust Services](https://pki.goog/repository/) y [DigiCert](https://knowledge.digicert.com/general-information/digicert-trusted-root-authority-certificates) | Autoridades certificadoras correspondientes | Procedencia de los certificados raíz públicos integrados en `certificados.h`. |

La configuración privada se mantiene en variables de Railway y en el `config.h` local de la XIAO. Los ejemplos `software/src/servidor/.env.example` y `software/src/firmware/XIAO_Remota/config.example.h` describen las variables con valores de ejemplo. `.gitignore` excluye dependencias instaladas, archivos `.env` privados, `config.h` y `ca.pem`. Los certificados raíz públicos incluidos en el firmware no son contraseñas ni claves privadas.

### Modelado, documentación CAD y materiales

| Fuente | Autor u origen | Aplicación |
|---|---|---|
| [Autodesk Fusion](https://www.autodesk.com/products/fusion-360/overview) | Autodesk | Herramienta observada en las capturas para modelado y ensamble del encapsulado. No se confunde su licencia de uso con la autoría o licencia del diseño del equipo. |
| LA CARCASA - Blueprint.pdf | Matías Armijo H., según el cajetín, 16-11-26 | Fuente primaria del equipo para cotas, vistas y tolerancias indicadas. |
| Seis capturas del ensamble y README de diseño | Equipo del proyecto; README asistido con ChatGPT | Evidencias de colocación de componentes y documentación del diseño. |
| Tres publicaciones de GrabCAD citadas arriba | Autores de cada publicación, por completar | Referencias geométricas de XIAO, batería y SS12D00. |
| `hardware/bom/BOM.md` y `BOM.csv` | Documentos del proyecto | Componentes, cantidades y precios de referencia (los materiales fueron entregados por la universidad). Precios de RobotShop (XIAO) y Prusa (insertos); el resto, estimados marcados como tales. Total ≈ 27 USD por dispositivo. |

## Datos

| Dato o recurso | Origen | Uso y alcance |
|---|---|---|
| Imágenes de entrenamiento | Capturas preparadas para el proyecto con objetos de las categorías elegidas y el escenario de fondo. | Entrenamiento en Teachable Machine. Se trabajó sobre variedad de posiciones, encuadres, objetos e iluminación. No se dispone de un inventario verificado de imágenes por clase. |
| Etiquetas originales | `software/src/servidor/model/metadata.json`. | Orden exacto: **Sin basura**, **Botellas**, **Papeles y Cartones**, **Bolsas**. La interfaz agrupa las últimas tres en **Hay basura**. |
| Arquitectura y pesos entrenados | Exportación del modelo del proyecto, con base MobileNet de terceros. | Se conservan en `software/src/servidor/model/`. No se atribuye al equipo la creación original de MobileNet. |
| Fotografías durante las pruebas | Cámara XIAO sobre el escenario y los residuos preparados para la demostración. | Capturas JPEG usadas por el sistema real. La miniatura mostrada corresponde a la última fotografía recibida. |
| Tabla `camaras` | Registros y ajustes del proyecto en PostgreSQL. | Identificación y configuración persistente: orientación, versión, umbral, zona de análisis y pausa de capturas/análisis. |
| Tabla `mediciones` | Resultados producidos por el servidor a partir de las fotografías de la XIAO. | Historial de fecha de recepción, puntuaciones por clase, suma de residuos, promedio y conclusión. Los gráficos conservan el resultado registrado en cada medición. |
| Tabla `estado_camara` | Estado operativo generado por el servidor. | Estado de la ventana de decisión y recuperación de la información necesaria para continuar el proceso. |
| Probabilidad combinada de basura | Cálculo del proyecto a partir de las salidas del modelo. | Suma de Botellas + Papeles y Cartones + Bolsas; no corresponde a un sensor que mida masa o volumen de residuos. |
| Promedio, umbral y confirmaciones | Algoritmo del proyecto. | Promedio móvil y evaluaciones consecutivas que estabilizan el resultado. Las confirmaciones evalúan ventanas superpuestas, no grupos independientes de fotografías. |
| Gráficos históricos y mapa diario | Consultas del proyecto sobre PostgreSQL. | Visualización de mediciones y cobertura temporal; los espacios sin datos y los resultados No seguro se distinguen de Sin basura. |
| Resumen diario y tendencias horarias | Agregación de las conclusiones almacenadas en `mediciones`; consulta `readDecisionTrends`. | Conteos y porcentajes Hay basura / Sin basura / No seguro por día y hora, sin reinterpretar ni volver a inferir las imágenes. El porcentaje es una fracción de registros y no una estimación de tiempo ocupado por basura. |
| Últimas confirmaciones y cambios | Consulta SQL sobre conclusiones confirmadas y su orden temporal. | Hasta ocho eventos por día; distingue cambios y nuevas confirmaciones después de interrupciones. La confianza asociada conserva el promedio de la medición o su complemento. |
| Video administrativo | Cuadros JPEG nuevos generados por la XIAO cuando una sesión administrativa solicita transmisión. | Flujo privado temporal WSS/MJPEG en memoria. No se guarda una grabación ni se ejecuta inferencia sobre cada cuadro de video; se diferencia del canal normal de fotos analizadas. |
| Exportaciones administrativas JSON/CSV | Lectura consistente de tablas del proyecto con sesión privada. | JSON de `camaras`, `estado_camara` y `mediciones`; CSV solo del historial de mediciones. No se incluyen variables de entorno o credenciales de conexión. |
| Plano y capturas CAD | Documentación del equipo recibida el 21 de noviembre de 2026. | Fuente de geometría y disposición representadas. No sustituye medición de batería real, fotografías del montaje o comprobación del archivo CAD nativo. |
| Exportaciones JSON utilizadas en la migración | Datos propios del sistema durante el paso de PostgreSQL de Railway a Aiven. | Comprobación y traslado del historial. Las exportaciones privadas no forman parte de la página pública. |
| Tiempos de análisis y registros HTTP | Medidos por el servidor y el firmware durante su funcionamiento. | Diagnóstico de latencia, errores y conectividad. Cada duración corresponde a la operación indicada por el registro, no necesariamente al ciclo completo. |
| Capturas de pantalla del monitor, Railway y Aiven | Pantallas del sistema aportadas durante el desarrollo y comprobaciones del servicio. | Evidencia funcional y diagnóstico; deben evitarse credenciales visibles al usarlas en el informe. |
| Datos e imágenes sintéticos de pruebas automatizadas | Generados dentro de `software/src/servidor/test/`. | Casos controlados para validar reglas, giro, recorte, permisos y base de datos. Se distinguen de las capturas reales de la cámara. |

El repositorio no documenta una evaluación independiente completa con precisión, recall o matriz de confusión del modelo sobre un conjunto de prueba separado. Los porcentajes visibles son puntuaciones del clasificador; no deben presentarse como exactitud experimental demostrada ni como una medición física de cantidad de basura.

Las fotografías, registros y pruebas del proyecto se describen según su origen real. La declaración de «datos inventados» del archivo de ejemplo no se aplica de manera general a este sistema.

## Herramientas

### Utilizadas en el desarrollo y la operación

| Herramienta o servicio | Uso en el proyecto | Referencia |
|---|---|---|
| Arduino IDE | Edición, compilación, carga del firmware y diagnóstico mediante el monitor serie a 115200 baudios. La versión exacta instalada no quedó registrada. | [Arduino IDE](https://www.arduino.cc/en/software) · [Código y licencia del IDE 2.x, AGPL-3.0](https://github.com/arduino/arduino-ide) |
| Teachable Machine | Captura/organización de ejemplos, entrenamiento y exportación del clasificador. | [Teachable Machine](https://teachablemachine.withgoogle.com/) |
| Git y GitHub | Repositorio, control de versiones, ramas, pull requests, revisiones y respaldo del método anterior. | [Git](https://git-scm.com/) · [GitHub Docs](https://docs.github.com/) |
| Railway | Alojamiento del servidor y monitor, ejecución del modelo, variables, logs, despliegues desde GitHub y primera base PostgreSQL. | [Railway Docs](https://docs.railway.com/) |
| Aiven Console y PG Studio | Alojamiento de la base PostgreSQL actual; administración, consulta SQL, revisión de tablas y uso de credenciales/certificado del servicio. | [Aiven PostgreSQL](https://aiven.io/docs/products/postgresql) |
| Docker | Empaquetado del servidor en la imagen definida en `software/src/servidor/Dockerfile`, ejecutada por Railway. | [Docker Docs](https://docs.docker.com/) |
| Node.js y npm | Ejecución del servidor, instalación de dependencias y scripts de migración y verificación. | [Node.js](https://nodejs.org/) · [npm Docs](https://docs.npmjs.com/) |
| Node Test Runner y PGlite | Pruebas automatizadas de lógica, API, permisos, base de datos y componentes de interfaz. | [Node Test Runner](https://nodejs.org/api/test.html) · [PGlite](https://pglite.dev/) |
| Compilador C++ `g++` | Comprobación automatizada del planificador de capturas en `software/src/servidor/test/demo.test.js`, cuando está disponible en el entorno de pruebas. | [GCC](https://gcc.gnu.org/) |
| Google Chrome | Consulta del monitor y las consolas, pruebas visuales, arrastre y uso del teclado en los controles web. | [Google Chrome](https://www.google.com/chrome/) |
| Autodesk Fusion | Modelado y ensamble digital de la carcasa y los componentes observados en las seis capturas. Versión exacta no registrada. | [Autodesk Fusion](https://www.autodesk.com/products/fusion-360/overview) |
| GrabCAD Library | Procedencia de las tres referencias CAD comerciales citadas; no es el autor del diseño de carcasa del equipo. | Enlaces individuales en Modelos 3D de terceros. |
| ChatGPT / Codex | Asistencia en arquitectura, programación, depuración, documentación, pruebas y operaciones autorizadas en GitHub y Railway. | [ChatGPT](https://chatgpt.com/) · [Codex](https://openai.com/codex/) |
| Red WiFi y conexión compartida desde iPhone | Acceso de la XIAO a Internet y pruebas de conexión en modo estación. | API WiFi de Espressif citada anteriormente; infraestructura de las pruebas. |

La relación anterior identifica herramientas de desarrollo o servicios; sus términos de uso no se transfieren como licencia al código propio del proyecto.

### Alternativas y procedimientos comentados

| Herramienta o enfoque | Participación en el desarrollo |
|---|---|
| Vercel | Alternativa considerada durante el diseño del acceso remoto. El despliegue documentado utiliza Railway. |
| DBeaver Community | Alternativa propuesta para administrar Aiven y exportar directamente a JSON. No consta todavía su instalación ni una exportación realizada con él. |
| PowerShell | Procedimiento explicado para extraer el contenido JSON de un CSV descargado desde Aiven; no es una dependencia del sistema desplegado. |
| Ejecución del modelo en la placa | Alternativa discutida al comparar dónde realizar la inferencia. La implementación documentada ejecuta el modelo en Railway. |

### Información no registrada

Durante el desarrollo no quedaron registradas las versiones exactas de Arduino IDE, del parche de Arduino-ESP32 3.3.x ni de Autodesk Fusion; tampoco el inventario por clase de las imágenes de entrenamiento ni los autores y licencias de las publicaciones de GrabCAD (la consulta devolvió acceso denegado). Estos datos no se inventan. Las referencias y versiones identificadas en este documento permiten distinguir el trabajo del proyecto de sus componentes externos.
