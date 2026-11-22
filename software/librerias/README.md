# Librerías y versiones

No se redistribuye ninguna librería en esta carpeta: se instalan desde su fuente oficial. Detalle de origen y licencias en [`FUENTES.md`](../../FUENTES.md).

## Firmware (Arduino IDE)

| Librería | Versión | Cómo se obtiene |
|---|---|---|
| esp32 by Espressif Systems (Arduino-ESP32) | 3.3.x | Gestor de placas |
| `WiFi.h`, `esp_camera.h`, `esp_http_client.h` | incluidas en el core | Vienen con el paquete de placas |
| WebSockets (Markus Sattler) | 2.7.2 | Gestor de librerías |

## Servidor (Node.js 22, `software/src/servidor/package.json`)

| Librería | Versión | Uso |
|---|---|---|
| @tensorflow/tfjs | 4.22.0 | Ejecuta el modelo de Teachable Machine |
| sharp | 0.35.5 | Gira, recorta y escala las fotos |
| pg | 8.23.1 | Conexión a PostgreSQL (Aiven) |
| ws | 8.23.0 | Video en vivo por WebSocket |
| @electric-sql/pglite | 0.5.16 | Solo para pruebas (PostgreSQL en memoria) |
