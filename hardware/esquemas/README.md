# Esquema de conexiones

**Archivo:** [`diagrama_circuito.pdf`](diagrama_circuito.pdf) (diagrama de conexiones del Avance #2)

El diagrama muestra la XIAO ESP32-S3 Sense con el módulo de cámara, la antena WiFi externa y la batería LiPo soldada a los pads de batería de la placa.

## Conexiones

| Desde | Hacia | Notas |
|---|---|---|
| Batería LiPo (+) | Interruptor SPDT → pad BAT+ de la XIAO | Cable rojo. El interruptor se agregó en el Avance #3 |
| Batería LiPo (−) | Pad BAT− de la XIAO | Cable negro |
| Módulo de cámara OV3660 | Conector FPC de la placa Sense | Sin soldadura |
| Antena WiFi | Conector U.FL de la XIAO | Viene con el kit |
| USB-C de la XIAO | Exterior de la carcasa | Carga de batería y programación |

## Decisiones de diseño

- La batería va soldada a los pads de la XIAO para que el dispositivo funcione sin cable USB. La XIAO trae el circuito de carga integrado, así que no se necesita un módulo cargador aparte.
- El interruptor corta el positivo de la batería: apaga el equipo en terreno sin abrir la carcasa.
- No se usan pines GPIO externos: la cámara usa el conector dedicado del módulo Sense.

> [PENDIENTE: actualizar el diagrama para que incluya el interruptor (puede hacerse en Fritzing, en EasyEDA o a mano y escaneado).]
