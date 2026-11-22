# Lista de materiales (BOM) — Cámara de detección de basura

Lista adaptada al prototipo basado en **Seeed Studio XIAO ESP32-S3 Sense con cámara OV3660**, batería, interruptor y carcasa propia.

> **Precios en blanco:** no se han proporcionado comprobantes ni precios reales de compra de estos materiales. Las columnas **Unitario CLP**, **Subtotal CLP** y el **Total** se dejan vacías para que el equipo las complete en pesos chilenos. Una celda vacía no significa costo cero. Los enlaces de compra también quedan vacíos cuando no se dispone del enlace real.

La versión editable para Excel está en [BOM.csv](BOM.csv). Contiene los mismos materiales y observaciones que las dos tablas siguientes.

## Componentes y materiales del prototipo

| Ref | Componente | Cant. | Unitario CLP | Subtotal CLP | Función | Observaciones | Enlace de compra |
|---|---|---|---|---|---|---|---|
| U1 | Seeed Studio XIAO ESP32-S3 Sense con módulo de cámara OV3660 | 1 |  |  | Captura de fotografías y envío por WiFi al servidor. | Contar el conjunto una sola vez si la placa y el módulo de cámara se compraron como kit. |  |
| BAT1 | Batería recargable para la XIAO | 1 |  |  | Alimentación autónoma del dispositivo. | POR COMPLETAR: transcribir tensión, capacidad y dimensiones de la etiqueta de la batería física. El modelo CAD 523450 es una referencia; confirmar que corresponde con la instalada. |  |
| SW1 | Interruptor deslizante SPDT, referencia CAD SS12D00 | 1 |  |  | Encendido y apagado de la alimentación del prototipo. | POR COMPLETAR: confirmar referencia del interruptor físico y forma de conexión. |  |
| C1 | Mitad inferior de la carcasa — C. Inferior | 1 |  |  | Alojamiento y apoyo de la batería, la electrónica y el cableado. | Diseño propio del proyecto. POR COMPLETAR: material, fabricación y costo real. |  |
| C2 | Mitad superior de la carcasa — C. Superior | 1 |  |  | Cierre del encapsulado y acceso de la lente a la escena observada. | Diseño propio del proyecto. POR COMPLETAR: material, fabricación y costo real. |  |
| W1 | Juego de conductores de alimentación, rojo y negro | 1 |  |  | Conexiones de alimentación entre batería, interruptor y placa. | Cantidad expresada como un juego. POR COMPLETAR: longitud y calibre del cableado real. |  |
| USB1 | Cable USB de datos con conector USB-C para la XIAO | 1 |  |  | Carga del firmware, conexión al computador y alimentación por USB. | Accesorio de uso; no queda necesariamente incorporado al prototipo. Si se reutilizó, registrar su tratamiento en el presupuesto. |  |

## Elementos por confirmar o cuantificar

Estos elementos deben revisarse contra el montaje físico. No se declaran comprados ni instalados por el solo hecho de aparecer en la documentación o de ser posibles accesorios.

| Ref | Componente | Cant. | Unitario CLP | Subtotal CLP | Función | Observaciones | Enlace de compra |
|---|---|---|---|---|---|---|---|
| D1 | Disipador compatible con la XIAO | 1 |  |  | Disipación de calor, si se instala en el prototipo físico. | Representado en el ensamble CAD. POR COMPLETAR: confirmar instalación física, modelo y medidas. |  |
| H1 | Tornillería y elementos de fijación |  |  |  | Unión de las mitades y sujeción de los componentes. | POR COMPLETAR: cantidad, diámetro, longitud y tipo de tornillos, tuercas, insertos o separadores realmente utilizados. |  |
| SOP1 | Soporte o sistema de anclaje de la cámara |  |  |  | Mantener posición y orientación durante el uso. | POR COMPLETAR: describir el soporte real, sus materiales y cantidad; no se aportó un plano independiente. |  |
| A1 | Antena WiFi externa, si corresponde al conjunto instalado |  |  |  | Conectividad inalámbrica de la XIAO. | POR COMPLETAR: confirmar uso y si venía incluida en el kit; no duplicar su costo si estaba incluida. |  |
| CON1 | Consumibles de montaje y aislamiento |  |  |  | Soldadura y aislamiento de las conexiones, según el montaje real. | POR COMPLETAR: tipo y cantidad de estaño, termorretráctil u otros consumibles efectivamente utilizados. |  |

## Total

| Concepto | Monto CLP |
|---|---|
| **Total de materiales** | |

**POR COMPLETAR POR EL EQUIPO:** el total solo puede calcularse después de confirmar las cantidades pendientes y completar los costos reales. Para cada fila, el subtotal corresponde a cantidad × precio unitario. Si un elemento finalmente no se utiliza, debe retirarse de la lista.

## Cómo completar los costos

- La placa y la cámara se agrupan como un conjunto. Si se compraron por separado, dividir U1 en dos filas y usar los precios de sus comprobantes; no cobrar la cámara dos veces.
- El precio de C1 y C2 corresponde a fabricar cada mitad. Si se contrató una impresión conjunta, registrar el costo una sola vez y dejar explicado dónde se contabilizó. No sumar además todo el filamento si ya está incluido en el servicio.
- Confirmar la batería a partir del componente físico. El modelo 3D de referencia no permite asegurar su capacidad ni sus dimensiones reales.
- Para materiales reutilizados o ya disponibles, indicar si el presupuesto mide el gasto adicional del proyecto o el costo de reposición. No asignarles automáticamente un valor de cero.
- Los enlaces de GrabCAD son referencias de modelos 3D, no enlaces de compra de componentes.
- Herramientas, computador de programación, router y despacho no están sumados en este total. Si la pauta los exige, añadir sus costos por separado y explicar el criterio usado.

## Servicios y herramientas digitales

Railway aloja el servidor de análisis; PostgreSQL de Aiven almacena las mediciones; GitHub mantiene el código; Teachable Machine se utilizó para entrenar el clasificador; y Autodesk Fusion se utilizó para el diseño CAD. Son servicios o herramientas del proyecto y no componentes físicos del dispositivo.

**POR COMPLETAR POR EL EQUIPO:** si la entrega exige contabilizar servicios, licencias o consumo de nube, registrar sus costos efectivos en un presupuesto separado. No se asignan precios ni cargos no documentados a esos servicios en este BOM.
