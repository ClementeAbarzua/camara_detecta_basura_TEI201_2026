# Código fuente

## `firmware/XIAO_Remota/` — firmware final

| Archivo | Qué hace |
|---|---|
| `XIAO_Remota.ino` | Programa principal: conexión WiFi con reconexión, captura JPEG de 800 × 600, envío HTTPS a Railway con token, pausa remota desde `/admin` y video en vivo por WebSocket para orientar la cámara |
| `capture-schedule.h` | Calcula la espera entre fotos: ciclo de 5 s en demo o 15 s después de cada envío en modo estable |
| `certificados.h` | Certificados raíz públicos para validar la conexión HTTPS |
| `config.example.h` | Plantilla: copiar como `config.h` y completar WiFi, URL y token. **`config.h` no se sube** (está en `.gitignore`) |

### Configuración de Arduino IDE

- Paquete de placas: **esp32 by Espressif Systems 3.3.x**
- Placa: **XIAO_ESP32S3**, PSRAM **OPI PSRAM**, USB CDC On Boot **Enabled**
- Librería: **WebSockets** de Markus Sattler, versión **2.7.2** (gestor de librerías)

## `servidor/` — servidor y dashboard

Ver [`servidor/README.md`](servidor/README.md).

## `firmware/XIAO_Deteccion_WiFi/` — versión anterior

Firmware de la iteración 3 (Avance #2). La placa servía una página web y el modelo corría en el navegador de quien la abría. No guardaba datos y solo funcionaba en la misma red. Se reemplazó por `XIAO_Remota` para que el análisis siguiera funcionando con el navegador cerrado y los datos quedaran guardados.
