# Código fuente

## `firmware/XIAO_Deteccion_WiFi/`

| Archivo | Qué hace |
|---|---|
| `XIAO_Deteccion_WiFi.ino` | Programa principal. Inicia la cámara, se conecta al WiFi (reintenta cada 20 s sin bloquear `loop()`) y levanta dos servidores HTTP: puerto 80 (página, modelo y `/capture`) y puerto 81 (video MJPEG). |
| `assets.h` | Página web, librerías JavaScript y modelo comprimidos con gzip, guardados en la flash de la placa. Se genera con `herramientas/generar_assets.py`. |
| `web_fuentes/index.html`, `web_fuentes/app.js` | Fuentes de la página: piden capturas, ejecutan el modelo y aplican la regla de decisión. |
| `herramientas/generar_assets.py` | Convierte `web_fuentes/` y el modelo en `assets.h`. Ejecutar si se cambia la página o el modelo. |
| `THIRD_PARTY_NOTICES.txt`, `APACHE_LICENSE.txt` | Licencias de TensorFlow.js y Teachable Machine. |

### Configuración de Arduino IDE

- Paquete de placas: **esp32 by Espressif Systems 3.3.0**
- Placa: **XIAO_ESP32S3**
- PSRAM: **OPI PSRAM**
- USB CDC On Boot: **Enabled**
- Partition Scheme: **Maximum APP (7.9MB APP No OTA/No FS)**

Antes de subir el código, reemplaza `NOMBRE_DE_TU_WIFI` y `CONTRASENA_DE_TU_WIFI` por tu red. No subas tu contraseña real al repositorio.

## `servidor/`

Servidor y dashboard en Railway. Ver [`servidor/README.md`](servidor/README.md).
