# Diseño 3D — Cámara de detección de basura

Este apartado documenta el encapsulado y el ensamble digital del prototipo de detección de basura basado en una **Seeed Studio XIAO ESP32-S3 Sense con cámara OV3660**. La carcasa integra la placa, la cámara, la batería, el interruptor y el disipador representados en el modelo, con accesos para la lente, el puerto USB-C y el accionamiento del interruptor.

La XIAO toma fotografías y las envía por WiFi al servidor alojado en Railway. El análisis de las imágenes se realiza en el servidor y las mediciones se almacenan en PostgreSQL de Aiven. Por eso, el diseño debe dejar despejada la lente y permitir alimentar, programar y posicionar el dispositivo.

> **Información comprobada y datos pendientes.** Las seis imágenes de esta carpeta son capturas del modelo CAD proporcionado por el equipo, y el PDF corresponde al plano **LA CARCASA**. Las medidas y tolerancias indicadas aquí proceden de ese plano. Las capturas permiten observar la distribución de componentes, pero no demuestran por sí solas que el archivo nativo abra correctamente, que no existan interferencias o que la pieza ya haya sido impresa y probada. Donde falta información se indica **POR COMPLETAR POR EL EQUIPO**.

## Requisito del gemelo 3D

El gemelo 3D debe representar el prototipo completo y sus componentes con dimensiones acordes a los elementos físicos. En las capturas del navegador de Fusion se observan los cuerpos **C. Inferior** y **C. Superior**, además de los componentes importados de la XIAO, la batería, el interruptor y un elemento denominado **Disipador**.

| Componente | Representación observada y verificación pendiente |
|---|---|
| Carcasa inferior — C. Inferior | Cuerpo de la carcasa con espacio interior para la batería y la electrónica. Se observa separado de la tapa en las vistas del ensamble. |
| Carcasa superior — C. Superior | Segunda mitad del encapsulado, con abertura para la cámara. Se observa la unión entre ambas mitades y los accesos a los componentes. |
| XIAO ESP32-S3 Sense y módulo de cámara | Modelo importado visible en el ensamble; la lente se alinea con la abertura de la carcasa y el USB-C queda accesible desde el frente. **POR COMPLETAR POR EL EQUIPO:** comprobar que la versión del modelo y sus dimensiones coincidan con la placa y cámara usadas. |
| Batería | Modelo importado identificado como **523450 Li-iron Battery 1000 mAh**, ubicado bajo la electrónica. **POR COMPLETAR POR EL EQUIPO:** confirmar dimensiones, capacidad y correspondencia con la batería física instalada; la referencia del modelo CAD no acredita esos valores en la batería real. |
| Interruptor deslizante | Modelo importado **SPDT slide switch SS12D00**, con acceso lateral para accionarlo. **POR COMPLETAR POR EL EQUIPO:** confirmar su sujeción y que la referencia coincida con el interruptor físico. |
| Disipador | El navegador del ensamble incluye un componente denominado **Disipador**. **POR COMPLETAR POR EL EQUIPO:** indicar modelo, dimensiones, ubicación exacta, forma de fijación y si está instalado en el prototipo físico. |
| Cableado de alimentación | En las vistas del ensamble se representan conductores rojo y negro asociados al conjunto de alimentación. **POR COMPLETAR POR EL EQUIPO:** confirmar recorrido real, calibre, puntos de soldadura y holguras al cerrar la carcasa. Las capturas no sustituyen el esquema eléctrico. |
| Alojamientos y apoyos internos | Se observan apoyos y alojamientos cilíndricos en la geometría de la carcasa. **POR COMPLETAR POR EL EQUIPO:** indicar número y tipo de fijaciones, dimensiones de los apoyos y método de sujeción de la placa y la batería. |
| Soporte para posicionar la cámara | No se ha aportado un archivo o plano independiente del soporte de montaje. **POR COMPLETAR POR EL EQUIPO:** incorporar el soporte, abrazadera o sistema de anclaje realmente utilizado, si forma parte del prototipo. |

**Archivo nativo pendiente:** **POR COMPLETAR POR EL EQUIPO:** agregar en `fusion360/` el ensamble final en `.f3d` o `.f3z`, comprobar que abre en Fusion y que conserva todos los componentes y referencias necesarios. No se adjuntó ese archivo a esta documentación, por lo que no se declara verificado.

## Carpetas

| Carpeta | Contenido |
|---|---|
| [fusion360](fusion360/) | Carpeta reservada para el archivo nativo final. **POR COMPLETAR POR EL EQUIPO:** incorporar el `.f3d`/`.f3z` y las exportaciones de fabricación, si corresponden. |
| [renders](renders/) | Seis capturas del ensamble CAD: conjunto cerrado, interior sin tapa, frente USB-C, lateral, conjunto desmontado y vista superior. Son capturas de trabajo de Fusion, no fotografías del prototipo físico. |
| [planos](planos/) | [LA CARCASA — plano técnico](planos/LA_CARCASA_Blueprint.pdf), con vistas, cotas, tolerancias y cajetín. |

## Especificaciones de la caja

| Dato | Valor documentado |
|---|---|
| Software de modelado | Autodesk Fusion, según la interfaz mostrada en las capturas. **POR COMPLETAR POR EL EQUIPO:** versión utilizada, si se exige en la entrega. |
| Identificación del diseño | **LA CARCASA**. |
| Autor indicado en el plano | **Matías Armijo H.** |
| Fecha junto al autor del plano | **16-11-26**, correspondiente al 16 de noviembre de 2026. |
| Unidades de las cotas utilizadas aquí | Milímetros; el plano explicita mm en la tolerancia de atornillado. |
| Longitud del cuerpo | **77 mm**, según la vista lateral del plano. |
| Anchura máxima del cuerpo | **58 mm**, según la vista superior del plano. |
| Altura del cuerpo | **30 mm**, según la vista frontal del plano. |
| Dimensiones del cuerpo, largo × ancho máximo × alto | **77 × 58 × 30 mm**. Estas cotas describen la carcasa; no se añade una medida no documentada para salientes de la lente u otros componentes. |
| Altura de las dos mitades | El plano divide el cuerpo en **15 mm + 15 mm**. |
| Anchura de la cara plana en el perfil frontal | **38 mm**. Esta cota no es la anchura máxima: los laterales inclinados amplían el cuerpo hasta 58 mm. |
| Geometría exterior | Cuerpo alargado con caras laterales inclinadas y dos mitades separables, según las vistas del plano y del ensamble. |
| Escala del plano | **1,5:1**, indicada en el cajetín. Las dimensiones se toman de las cotas, no de medir la imagen ni de la escala de impresión del PDF. |
| Tolerancias generales indicadas | **ISO 2768-c**. Se registra lo que especifica el plano; no se afirma que se haya medido el cumplimiento en la pieza fabricada. |
| Tolerancia de atornillado indicada | **0,10 mm**. **POR COMPLETAR POR EL EQUIPO:** precisar los alojamientos a los que aplica y verificar el ajuste real. |
| Material y color de fabricación | **POR COMPLETAR POR EL EQUIPO:** indicar el material realmente utilizado —por ejemplo, PLA o PETG solo si corresponde— y su color. El aspecto del modelo CAD no permite determinarlo. |
| Espesor de paredes y base | **POR COMPLETAR POR EL EQUIPO:** anotar los espesores del modelo final. |
| Ajuste entre las dos mitades | **POR COMPLETAR POR EL EQUIPO:** indicar holgura de cierre, sistema de encaje y tolerancia aplicada. No confundirlo con la tolerancia de atornillado del plano. |
| Tornillería | **POR COMPLETAR POR EL EQUIPO:** cantidad, diámetro, longitud y tipo de tornillos, tuercas o insertos. No se asume que sean M3. |
| Peso de la carcasa y del conjunto | **POR COMPLETAR POR EL EQUIPO:** registrar los valores medidos y distinguir carcasa sola de prototipo completo. |

## Funcionalidad del encapsulado

- **Acceso de la cámara:** una abertura en la cara superior deja expuesta la lente. Al montar el prototipo se debe comprobar que el borde no obstruya el campo de visión ni la zona de análisis configurada en el monitor.
- **Acceso al USB-C:** el frente dispone de una abertura alineada con el puerto de la XIAO, para conectar el cable sin abrir por completo el encapsulado. **POR COMPLETAR POR EL EQUIPO:** comprobar el espacio para el conector y la funda del cable real.
- **Accionamiento del interruptor:** se observa una abertura lateral alineada con el interruptor deslizante. **POR COMPLETAR POR EL EQUIPO:** confirmar que pueda recorrer sus posiciones con la carcasa cerrada y que no se desplace su cuerpo.
- **Ventilación:** las capturas y el plano muestran ranuras laterales. **POR COMPLETAR POR EL EQUIPO:** indicar cantidad, medidas y resultados de una prueba de temperatura si se realizó; no se declara una capacidad de refrigeración solo por la presencia de ranuras.
- **Distribución interna:** la batería se representa en la zona inferior del conjunto y la placa con cámara encima. Las vistas desmontada e interior permiten observar esta disposición y el recorrido representado de los conductores.
- **Apertura y mantenimiento:** las dos mitades permiten acceder a la electrónica. **POR COMPLETAR POR EL EQUIPO:** describir el procedimiento real de apertura y cierre, las herramientas necesarias y el método de unión definitivo.
- **Posicionamiento:** la carcasa reúne los componentes en un conjunto que puede orientarse hacia el área observada. **POR COMPLETAR POR EL EQUIPO:** describir cómo se fija al soporte o lugar de instalación y cómo se evita que cambie de posición durante la medición.

**Comprobaciones pendientes del montaje:** **POR COMPLETAR POR EL EQUIPO:** verificar interferencias, sujeción de la batería y placa, aislamiento de contactos, espacio del cableado y acceso a USB-C e interruptor. No se declara resistencia al agua ni un grado IP con la documentación disponible.

## Capturas del modelo CAD

### Ensamble completo

Vista del encapsulado con los componentes visibles mediante transparencia.

![Ensamble completo de la carcasa con cámara e interruptor](renders/01_ensamble_completo.jpeg)

### Interior sin tapa

Distribución de la batería, la placa con cámara y el interruptor con la mitad superior oculta.

![Interior de la carcasa sin tapa](renders/02_interior_sin_tapa.jpeg)

### Vista frontal: acceso USB-C

Perfil frontal con el puerto USB-C y la separación entre las dos mitades del cuerpo.

![Vista frontal del acceso al USB-C](renders/03_vista_frontal_usb.jpeg)

### Vista lateral

Vista lateral con ranuras de ventilación, cableado y distribución vertical de los componentes.

![Vista lateral del ensamble](renders/04_vista_lateral.jpeg)

### Vista desmontada

Separación visual entre la carcasa y los componentes internos para mostrar la integración del conjunto. Esta captura no constituye por sí sola una secuencia de montaje.

![Vista desmontada de la carcasa y el conjunto electrónico](renders/05_vista_desmontada.jpeg)

### Vista superior

Distribución en planta de la cámara, la batería, el interruptor y los alojamientos internos.

![Vista superior del ensamble](renders/06_vista_superior.jpeg)

## Plano técnico

El archivo [LA_CARCASA_Blueprint.pdf](planos/LA_CARCASA_Blueprint.pdf) contiene vistas frontal, lateral, superior e isométrica en una hoja. Documenta las cotas principales **77, 58, 38 y 30 mm**, la división de **15 + 15 mm**, la escala **1,5:1** y las tolerancias indicadas en la tabla anterior.

**POR COMPLETAR POR EL EQUIPO:** añadir cotas de aberturas, alojamientos de tornillos, apoyos y espesores si se necesitan para fabricar la pieza sin consultar el modelo CAD. Completar también número de plano, revisión, fecha de emisión y demás campos del cajetín que correspondan y estén vacíos.

## Fabricación y validación

| Dato de fabricación o prueba | Información pendiente |
|---|---|
| Estado de fabricación | **POR COMPLETAR POR EL EQUIPO:** indicar si la carcasa ya se imprimió, está en fabricación o solo está modelada. |
| Método y equipo | **POR COMPLETAR POR EL EQUIPO:** proceso de fabricación, marca y modelo de impresora o equipo utilizado. |
| Archivos de fabricación | **POR COMPLETAR POR EL EQUIPO:** añadir STL/3MF u otros archivos de cada mitad, indicando unidades y versión. |
| Orientación, soportes y adhesión | **POR COMPLETAR POR EL EQUIPO:** documentar orientación de cada pieza, necesidad de soportes y método de adhesión a la cama, si se imprimió en 3D. |
| Parámetros de impresión | **POR COMPLETAR POR EL EQUIPO:** altura de capa, diámetro de boquilla, perímetros, relleno, temperaturas y velocidad realmente utilizados. |
| Tiempo y material consumido | **POR COMPLETAR POR EL EQUIPO:** tiempo de fabricación y cantidad de material, con sus unidades. |
| Montaje físico | **POR COMPLETAR POR EL EQUIPO:** confirmar cierre, ausencia de interferencias, acceso al cable USB-C, accionamiento del interruptor y fijación de todos los componentes. |
| Prueba de funcionamiento | **POR COMPLETAR POR EL EQUIPO:** registrar una prueba con la carcasa cerrada, incluyendo captura de imagen, conexión WiFi, envío al servidor y comprobación del campo de visión. |
| Evidencia física | **POR COMPLETAR POR EL EQUIPO:** incorporar fotografías del prototipo montado y describir ajustes o diferencias respecto al modelo. |

## Modelos 3D externos utilizados

Las siguientes referencias fueron proporcionadas para los componentes importados del ensamble. El diseño de la carcasa se documenta por separado; usar modelos externos de componentes no atribuye al equipo su autoría.

| Modelo | Uso en el ensamble | Fuente |
|---|---|---|
| Seeed Studio XIAO ESP32-S3 Sense | Representación de la placa y el módulo de cámara para organizar el espacio y alinear las aberturas. | [GrabCAD — XIAO ESP32-S3 Sense](https://grabcad.com/library/seeed-studio-xiao-esp32s3-sense-1) |
| 523450 Li-iron Battery 1000 mAh | Referencia geométrica de la batería representada en el conjunto. Confirmar que corresponda con la batería física. | [GrabCAD — batería 523450](https://grabcad.com/library/523450-li-iron-battery-1000mah-3-7wh-dc4-2v-1) |
| SS12D00 | Referencia geométrica del interruptor deslizante y su abertura de acceso. | [GrabCAD — SS12D00](https://grabcad.com/library/ss12d00-1) |
| Disipador | Componente presente en el navegador del ensamble. | **POR COMPLETAR POR EL EQUIPO:** indicar si es diseño propio o externo; si es externo, añadir autor y enlace. |

**POR COMPLETAR POR EL EQUIPO:** registrar autor, licencia o condiciones de uso de cada modelo externo y las modificaciones realizadas. Estos datos no se pudieron verificar en las páginas de GrabCAD durante la preparación del documento. Citar también estos recursos en `FUENTES.md` del repositorio.

## Uso de IA en esta documentación

Se utilizó ChatGPT para adaptar el README de referencia al prototipo, organizar la información del plano y las capturas, y señalar los datos pendientes. La asistencia no incluyó crear ni verificar el archivo CAD nativo, fabricar la carcasa o ejecutar pruebas físicas del montaje. El equipo debe completar los campos marcados y revisar que el texto coincida con el prototipo final.
