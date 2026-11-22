# Diseño 3D — "LA CARCASA"

## Archivos

| Carpeta / archivo | Contenido |
|---|---|
| `fusion360/Presentacion 3/LA CARCASA (f3d).f3z` | **Modelo final** en Fusion 360, con el ensamble completo |
| `fusion360/Presentacion 3/LA CARCASA (stl).stl` | Exportación para imprimir |
| `fusion360/Presentacion 2/Sensor Carcasa e Interior Design.step` | Diseño anterior (Avance #2, carcasa hexagonal) |
| `planos/LA CARCASA - Blueprint.pdf` | Plano técnico con cotas y tolerancias |
| `renders/` | Renders finales (exterior, interior y explosionado), capturas del ensamble e imágenes de iteraciones anteriores |

## Gemelo 3D

El ensamble de Fusion 360 incluye todos los componentes reales, no solo la carcasa:

- **C. Inferior** y **C. Superior**: las dos mitades de la carcasa (diseño propio).
- **Seeed Studio XIAO ESP32-S3 Sense** con cámara: modelo de GrabCAD (ver `FUENTES.md`).
- **Batería Li-ion 523450**: volumen referencial de la batería.
- **Interruptor SPDT SS12D00**.
- **Disipador**.

## Especificaciones

| Parámetro | Valor |
|---|---|
| Software | Autodesk Fusion 360 |
| Unidades | mm |
| Dimensiones externas | 77 × 58 × 30 mm (dos mitades de 15 mm) |
| Material | PLA (impresión 3D) |
| Tolerancias generales | ISO 2768-c |
| Tolerancia de atornillado | 0.10 mm |

## Decisiones de diseño

- **Dos mitades atornilladas sobre insertos de bronce:** se abre con un destornillador para reparar o cambiar componentes, sin pegamento. Los insertos evitan que la rosca se desgaste en el plástico.
- **Aberturas funcionales:** orificio para el lente arriba, USB-C al frente (carga y programación sin abrir), ranura lateral para el interruptor.
- **Ventilación:** ranuras en los costados para disipar el calor de la ESP32-S3 al procesar imágenes.
- **Soportes internos:** guías que mantienen la XIAO y la batería en posición fija, para que la cámara no se mueva.
- **Tamaño mínimo:** la carcasa se ajustó al volumen de la electrónica para que el dispositivo sea discreto en el espacio público.

## Evolución

- **Avance #2:** prisma hexagonal de 86 × 60 × 22 mm (archivo `.step`).
- **Avance #3:** carcasa nueva de 77 × 58 × 30 mm. Se agregaron insertos de bronce, interruptor y ventilación.

[PENDIENTE: agregar parámetros de impresión: impresora, altura de capa, relleno y tiempo.]
