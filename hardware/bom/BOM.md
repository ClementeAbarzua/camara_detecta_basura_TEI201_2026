# Lista de materiales (BOM)

Todos los componentes los entregó la universidad, así que el equipo no tuvo gasto directo. Para evaluar la viabilidad económica usamos **precios de referencia** de tiendas en línea. Los marcados como *estimado* son componentes genéricos de bajo costo.

Versión editable: [`BOM.csv`](BOM.csv).

| Ref | Componente | Cant. | Especificación | Unitario (USD) | Subtotal (USD) | Precio |
|---|---|---|---|---|---|---|
| U1 | Seeed Studio XIAO ESP32-S3 Sense (cámara + antena) | 1 | ESP32-S3, 8 MB PSRAM, WiFi 2.4 GHz | 15.26 | 15.26 | Tienda (RobotShop) |
| BAT1 | Batería LiPo | 1 | 3.7 V, ~1200 mAh (4.6 Wh) | 9.00 | 9.00 | Estimado |
| SW1 | Interruptor deslizante SPDT | 1 | SS12D00 o equivalente | 0.50 | 0.50 | Estimado |
| C1+C2 | Carcasa impresa en 3D (2 mitades) | 1 | PLA, ~40 g | 1.00 | 1.00 | Estimado |
| H1 | Inserto roscado de bronce M3 | 2 | Termofijado | 0.11 | 0.22 | Tienda (Prusa, 100 uds) |
| H2 | Tornillo M3 | 2 | Acero | 0.10 | 0.20 | Estimado |
| W1 | Cables de alimentación rojo y negro | 1 | Juego corto | 0.50 | 0.50 | Estimado |
| | **Total por dispositivo** | | | | **≈ 26.68 USD** | |

## Qué significa para el proyecto

Cada punto de monitoreo cuesta cerca de **27 USD** en materiales. Cubrir los ~45 microbasurales de Peñalolén costaría alrededor de **1.200 USD** en hardware, una fracción mínima de lo que la comuna destina a gestión y retiro de residuos (más de $5.124 millones de pesos al año).

## No incluido

- Herramientas (cautín, destornillador), computador y cable USB de programación: se reutilizan y no quedan en el dispositivo.
- Servicios en la nube (Railway, Aiven): se usaron sus planes gratuitos o de prueba. Ver `software/src/servidor/`.
