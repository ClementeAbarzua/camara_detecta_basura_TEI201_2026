# Cargar pausa remota y video continuo

1. En Arduino IDE instala **WebSockets**, de **Markus Sattler**, versión **2.7.2**, desde el gestor de bibliotecas.
2. Abre `XIAO_Remota.ino` de esta carpeta.
3. Conserva tu `config.h` anterior junto a este archivo, `capture-schedule.h` y `certificados.h`. Si ya tenías WiFi, URL y token configurados, no los reemplaces por la plantilla.
4. Selecciona **XIAO_ESP32S3**, **OPI PSRAM** y **USB CDC habilitado**. Carga el programa por USB.
5. En la web entra a `/admin`, pulsa **Pausar capturas y análisis** y luego **Iniciar video** para orientar la cámara con mayor fluidez. Al terminar, detén el video y reanuda las capturas.

La cámara transmite video continuo a un objetivo de 12 fps y 320×240. La frecuencia real depende de la red. Las fotos de análisis conservan 800×600. El firmware anterior de video lento no sirve para esta transmisión: se necesita cargar esta versión.

No publiques `config.h`: contiene las credenciales de tu red y de la cámara.
