# Hardware

## Carpetas

| Carpeta | Contenido |
|---|---|
| `esquemas/` | Diagrama de conexiones del circuito |
| `bom/` | Lista de materiales con cantidades y costos (`BOM.md` y `BOM.csv`) |
| `fotos/` | Fotografías del prototipo ensamblado desde varios ángulos |

## Componentes y por qué los elegimos

| Componente | Función | Justificación |
|---|---|---|
| **Seeed Studio XIAO ESP32-S3 Sense** | Microcontrolador con WiFi y cámara | Trae cámara, WiFi y 8 MB de PSRAM en una placa de 21 × 17.5 mm. La PSRAM permite manejar imágenes JPEG, y el tamaño permite una carcasa pequeña y poco llamativa en la calle. |
| **Cámara OV3660** (incluida en el módulo Sense) | Captura de imágenes | 3 MP, más que suficiente para distinguir bolsas, botellas y cartones a pocos metros. Va conectada por FPC, sin cableado extra. |
| **Batería LiPo 4.6 Wh** | Alimentación autónoma | El dispositivo funciona sin estar conectado por USB. La XIAO tiene cargador de batería integrado, así que se recarga por el mismo USB-C. |
| **Interruptor deslizante SPDT** | Encendido / apagado | Corta la batería sin desarmar la carcasa. |
| **Insertos de bronce + tornillos** | Cierre de la carcasa | Permiten abrir y cerrar la carcasa muchas veces sin desgastar el plástico impreso. |

## Ensamble

1. Soldar los cables de la batería (rojo +, negro −) a los pads BAT de la XIAO, pasando por el interruptor.
2. Conectar el módulo de cámara a la XIAO por su conector FPC y la antena WiFi al conector U.FL.
3. Ubicar la batería en el fondo de la mitad inferior y la XIAO en su soporte, con el USB-C alineado a la abertura frontal.
4. Montar el interruptor en su ranura lateral.
5. Cerrar con la mitad superior, con el lente alineado al orificio, y atornillar en los insertos de bronce.

## Diseño para la reparación

- Las dos mitades se unen **solo con tornillos** sobre insertos de bronce: se abren con un destornillador sin romper nada (foto `fotos/01_apertura_con_destornillador.jpg`).
- No hay pegamento en ninguna unión.
- El USB-C queda accesible desde afuera para cargar la batería y reprogramar sin abrir.
- La XIAO, la cámara y la batería pueden reemplazarse por separado.

## Especificaciones

| Parámetro | Valor |
|---|---|
| Alimentación | Batería LiPo 4.6 Wh (3.7 V nominal) o USB-C 5 V |
| Conectividad | WiFi 2.4 GHz |
| Dimensiones externas | 77 × 58 × 30 mm |
| Consumo | [PENDIENTE: medir con un medidor USB] |
| Autonomía estimada | [PENDIENTE: 4.6 Wh ÷ consumo medido en W] |
