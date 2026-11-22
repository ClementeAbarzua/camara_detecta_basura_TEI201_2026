# Librerías y versiones

No se redistribuye ninguna librería en esta carpeta: todas se instalan desde su fuente oficial. Detalle de origen y licencias en [`FUENTES.md`](../../FUENTES.md).

## Firmware (Arduino IDE)

| Librería | Versión | Cómo se obtiene |
|---|---|---|
| esp32 by Espressif Systems (Arduino-ESP32) | 3.3.0 | Gestor de placas de Arduino IDE |
| `WiFi.h`, `esp_camera.h`, `esp_http_server.h`, FreeRTOS | incluidas en 3.3.0 | Vienen con el paquete de placas |

El firmware no necesita librerías extra del gestor de librerías.

## Página de detección (embebida en `assets.h`)

| Librería | Versión |
|---|---|
| TensorFlow.js | 1.7.4 |
| @teachablemachine/image | 0.8.5 |

## Servidor (Node.js)

Ver `software/src/servidor/package.json`. [PENDIENTE: completar cuando se suba el servidor]
