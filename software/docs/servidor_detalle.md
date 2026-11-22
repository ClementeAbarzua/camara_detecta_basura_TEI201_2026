# Detector de basura XIAO · Railway + PostgreSQL en Aiven

Versión 3.2.0 · TALLER DISEÑO · 20 de noviembre de 2026.

La XIAO envía fotos por Internet al servidor de Railway. El servidor analiza cada imagen con el modelo de Teachable Machine, suma las probabilidades de residuos y guarda los resultados en PostgreSQL. El monitor es público y se puede abrir desde cualquier red, sin clave de consulta. La detección continúa con el navegador cerrado mientras la cámara, el servidor y la base estén encendidos.

La cámara comienza girada 180°. El panel privado `/admin` permite elegir 0° o 180° y cambiar la exigencia de decisión; estos ajustes se guardan en PostgreSQL y se aplican al análisis y al monitor público. Conserva la conexión TLS con CA de Aiven. Las descargas públicas siguen retiradas. Solo el administrador puede exportar JSON/CSV, pausar o reanudar la detección y activar video en vivo para posicionar la cámara. Los ajustes de giro, zona y exigencia no requieren cargar firmware; detener también las capturas físicas requiere el firmware de control descrito más abajo.

**Estado del proyecto al 20 de noviembre:** el servicio `xiao-monitor` está conectado al repositorio `santileonv/camara-basura`, rama `main`, raíz `/app`. La migración a Aiven se completó: las 119 mediciones originales coincidieron en todos sus campos al comparar las exportaciones, se comprobaron capturas nuevas en Aiven y el usuario confirmó que el sistema funciona con el PostgreSQL antiguo de Railway apagado. Los apartados de instalación y copia siguientes sirven como referencia para reproducir el proceso; no se debe repetir la copia sobre la base que ya contiene datos.

| Componente | Dónde funciona |
|---|---|
| Firmware y cámara | XIAO ESP32-S3 Sense |
| Código del servidor | GitHub: `santileonv/camara-basura` |
| Web y análisis del modelo | Railway: `Taller-Diseno-XIAO` → `xiao-monitor` |
| Base anterior conservada, apagada | Railway: `Postgres` |
| Base de datos actual | PostgreSQL de Aiven |
| Monitor | https://xiao-monitor-production.up.railway.app |

## Prueba de demostracion: ciclos de 5 segundos

El metodo estable anterior quedo respaldado en la rama `respaldo/metodo-estable-antes-demo-5s`, commit `8d7992c473f197e8dd9d068adfb95ba31b95bf1f`. La comparacion y los pasos completos para restaurarlo estan en [docs/MODO_DEMO_Y_REVERSION.md](docs/MODO_DEMO_Y_REVERSION.md).

La prueba usa `DETECTION_PROFILE=demo` por defecto: promedio de 3 capturas, minimo 3 para evaluar y 2 confirmaciones consecutivas. El firmware actualizado trae `DEMO_MODE=true`: descuenta el trabajo de captura, envio, analisis y respuesta del objetivo de 5000 ms. Es necesario volver a cargar ese firmware en la XIAO; desplegar Railway no cambia el programa de la placa. Conservar el `config.h` privado anterior y copiar tambien el nuevo `capture-schedule.h`.

El servidor avisa por `/api/events` despues de guardar cada medicion. La pagina actualiza estado y graficos en vivo al recibir el aviso, con consultas de respaldo cada 2 s si se corta esa conexion. Se cierra al ocultar la pestaña. No cambia el modelo ni añade dependencias o servicios. La fecha y los graficos historicos no saltan al vivo al llegar una foto.

Para restaurar las reglas anteriores sin perder la interfaz nueva, usar `DETECTION_PROFILE=stable` en Railway y `DEMO_MODE=false` en el firmware, con `CAPTURE_INTERVAL_MS=15000`. Cambiar de perfil reinicia solo el promedio activo en la siguiente captura; conserva las mediciones anteriores. Para restaurar tambien la implementacion web exacta, usar la rama de respaldo como fuente de un PR de restauracion.

## Apariencia: claro y oscuro

El selector **Claro / Oscuro** está en el encabezado del monitor y de administración. La primera visita respeta la preferencia del dispositivo; después de elegir un tema, se conserva en `localStorage` con la clave `xiao-theme`. La elección se comparte entre ambas páginas y se sincroniza entre pestañas del mismo navegador. Si el almacenamiento está bloqueado, el selector sigue funcionando en la página abierta. El script del tema se ejecuta antes de los estilos para evitar un destello del tema anterior.

Los gráficos SVG, el mapa del día, el calendario, las tablas, los estados y los controles usan la misma paleta mediante variables CSS. Cambiar de tema recolorea lo ya dibujado sin volver a consultar datos ni modificar el intervalo de los gráficos. Se mantienen foco de teclado visible, selección accesible con `aria-pressed`, controles táctiles y respeto a movimiento reducido. No se cargan fuentes, imágenes ni librerías desde servicios externos. La preferencia visual no cambia los ajustes compartidos de la cámara ni requiere administración.

## Consulta pública y administración

La página principal muestra la cámara, la conclusión, los porcentajes, el historial y los dos gráficos sin pedir contraseña. Las rutas de consulta son públicas y de solo lectura. La información que se muestra puede copiarse desde el navegador; proteger las descargas de administración no vuelve privados los datos visibles.

El monitor público no tiene botones de descarga. `GET /api/export.json` y `/api/export.csv` siguen sin estar registrados. Las nuevas descargas solo se ofrecen en `/admin` y `/api/admin/export` exige una sesión administrativa vigente; la cookie antigua y el token de cámara no permiten exportar.

## Administración protegida y ajustes persistentes

Entra mediante **Acceso de administrador** en el monitor o abre `/admin`. Usa la contraseña privada ya configurada en `DASHBOARD_PASSWORD` en Railway. Opcionalmente, `ADMIN_PASSWORD` permite usar otra clave exclusivamente para el panel; tiene prioridad si existe. La contraseña debe tener al menos 12 caracteres y `SESSION_SECRET` al menos 32. Las credenciales no se incluyen en GitHub, HTML ni respuestas públicas. No hay que volver a programar la XIAO.

Selecciona **Normal · 0°** o **Girada 180°**, ajusta la zona sobre la foto, elige la exigencia entre **60 % y 95 %** y pulsa **Guardar cambios**. La foto permite previsualizar el giro sin modificar el servidor. Recargar ajustes guardados descarta el borrador y recupera los valores actuales si otra pestaña los cambió.

El umbral es simétrico: con 80 %, el promedio de Botellas + Papeles y Cartones + Bolsas debe ser ≥80 % para proponer Hay basura o ≤20 % para proponer Sin basura; entre ambos se propone No seguro. Se mantienen las confirmaciones consecutivas del perfil activo. Reducir el valor facilita confirmar ambos resultados y aumentar el valor exige mayor confianza. La interfaz muestra los dos límites antes de guardar.

`camaras.rotacion` conserva el giro, `umbral_decision` guarda el umbral y `zona_analisis` guarda el recuadro y `orientacion_version` versiona todos los ajustes. `THRESHOLD` es únicamente el valor inicial si no hay umbral guardado. Los despliegues siguientes conservan los valores elegidos y eliminan la antigua restricción que fijaba el giro. Cambiar un ajuste incrementa la versión y la siguiente captura reinicia el promedio y sus confirmaciones. No se reescriben mediciones anteriores. Una inferencia iniciada con ajustes antiguos se rechaza con 409 si intenta guardarse después de un cambio. Guardar los mismos valores no incrementa la versión ni reinicia el promedio.

Las rutas `/api/admin/session`, `/api/admin/login`, `/api/admin/logout` y `/api/admin/settings` gestionan el acceso. Solo una sesión nueva creada con la contraseña puede consultar o modificar los ajustes. Las cookies de consulta antiguas y el token de la cámara no conceden permisos administrativos. El antiguo `/api/camera-settings` sigue retirado (410). Las rutas de consulta y el monitor siguen públicos; los controles y las exportaciones nuevos exigen la sesión de administrador.

Las sesiones duran hasta 8 horas, usan tokens aleatorios de 256 bits y se conservan por hash en memoria de la única réplica del servicio. Reiniciar o desplegar cierra las sesiones, pero conserva los ajustes de PostgreSQL. Cerrar sesión revoca el token inmediatamente y cambiar las credenciales invalida las sesiones anteriores. En producción la cookie `__Host-xiao_admin` tiene `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` y no tiene Domain. Cada escritura requiere además un token CSRF y un Origin exactamente coincidente; no se habilita CORS. Tras cinco contraseñas incorrectas se bloquea el origen de conexión durante 15 minutos. La aplicación no confía en X-Forwarded-For recibido: detrás de un proxy varios clientes pueden compartir ese límite. El contenido JSON se limita a 4 KB y se comprueban giro, zona, umbral y versión en el servidor y la base.

## Zona de análisis ajustable, solo para el administrador

En `/admin`, reduce o agranda el cuadrado con la esquina inferior derecha o el control **Tamaño del cuadrado**. Arrastra su interior para moverlo; también puedes usar Posición horizontal/vertical o las flechas del teclado (Shift da pasos mayores). La zona se mantiene dentro de la foto. El cuadrado no deforma los objetos al redimensionar a 224 × 224. El tamaño permitido es de 15 a 100 % del lado más corto de la imagen. **Restaurar cuadrado central** recupera el recorte original en el borrador; hay que guardar para aplicarlo.

La zona se define después del giro mediante `{centerX,centerY,size}` en coordenadas relativas a la imagen completa. Por defecto es `{centerX:0.5,centerY:0.5,size:1}`, que conserva el comportamiento anterior. PostgreSQL valida y conserva el JSON. El guardado comparte control de versión, sesión y CSRF con el giro y el umbral; un cliente antiguo que no envíe zona conserva la ya guardada. Cambiar solo la zona también incrementa la versión, invalida inferencias en curso y reinicia la ventana con la siguiente captura. Repetir los mismos valores no la reinicia.

El servidor gira primero, recorta exactamente esa zona y entrega sus píxeles al modelo. Conserva una miniatura de la foto completa orientada para poder editar el recuadro después. La última lectura guarda su zona, dimensiones originales y `analysisRegion` relativa; el monitor público usa esos datos para dibujar un recuadro de solo lectura y oscurecer el exterior. Cuando hay ajustes pendientes, muestra la zona nueva y espera una captura antes de presentar una conclusión vigente. Los controles de edición solo existen en el panel privado; las solicitudes públicas de escritura se rechazan en el servidor. No cambia el firmware ni se requiere cargar otra vez la placa.

## Avance de la decisión

El monitor muestra dos contadores separados: **Capturas mínimas** (3 para empezar) y **Confirmaciones seguidas** (2 en demo o 3 en stable). Indica Reuniendo capturas, Confirmando el resultado, Evidencia no concluyente o Resultado confirmado según las mediciones reales. El contador no avanza con el tiempo ni al refrescar la web. Si el promedio cambia de candidato o cae entre los umbrales, las confirmaciones anteriores dejan de contar. Un cambio de configuración o datos vencidos muestra espera y no presenta el avance anterior como actual.

Cada captura nueva actualiza el promedio móvil y produce una evaluación. Las confirmaciones no son grupos separados de capturas: en demo, con evidencia consistente, las capturas 1 y 2 reúnen datos, la 3 obtiene la primera confirmación y la 4 obtiene la segunda. La confianza de la conclusión permanece en su barra independiente; el progreso de las etapas no se presenta como un porcentaje de confianza.

## Archivos de configuración y secretos

`.gitignore` excluye `node_modules/`, `.env`, `.env.*`, `config.h`, `ca.pem` y `Config_XIAO_Railway.txt`; conserva `.env.example` como plantilla. La plantilla contiene únicamente marcadores ficticios para la conexión y el token. En este proyecto `DATABASE_CA_CERT` corresponde al certificado CA y `CAMERA_TOKEN` cumple el papel de la API_KEY del dispositivo. Las credenciales reales se configuran en las variables privadas de Railway y en el `config.h` local de la XIAO. La imagen Docker también excluye archivos `.env` y `ca.pem`.

Añadir un archivo a `.gitignore` no elimina una copia que ya estuviera registrada. Si se expone una credencial, hay que rotarla; borrar el archivo no anula el secreto ni su historial.

## Gráficos en tiempo real

Debajo de la cámara hay dos vistas complementarias del historial:

- **¿Hay basura?:** gráfico de escalones con solo dos niveles, Hay basura y Sin basura. Los saltos directos se dibujan verticalmente en la hora de la nueva conclusión. Los períodos No seguro interrumpen la línea y se sombrean en amarillo; la falta de datos se representa con rayado. No se convierte la incertidumbre en un resultado negativo.
- **Probabilidad de basura:** línea principal de la suma de Botellas + Papeles y Cartones + Bolsas promediada según el perfil activo (3 en demo, 5 en stable). Las zonas y líneas punteadas muestran los umbrales registrados en cada medición. Las capturas individuales están ocultas por defecto y pueden activarse con Mostrar cada captura. Debajo se distinguen el valor del promedio y el de la captura seleccionada.

Se retira el gráfico de porcentajes por clase y la franja duplicada de conclusiones. Las barras de la última captura y la tabla del historial conservan sus datos.

Los controles se agrupan en un panel con fecha, flechas de día anterior/siguiente, intervalos rápidos de **5 minutos · demo**, **15 minutos**, **1 hora** y **24 horas · día completo**, botones de zoom y **Volver al vivo**. Elegir una fecha abre su día completo; luego los intervalos y el zoom permiten acercarse y la barra horizontal recorre solamente las horas de ese día. Las barras de ambos gráficos están sincronizadas. En día completo la barra queda sin recorrido porque todo el día ya está visible. El panel indica la fecha y las horas exactas consultadas.

El día se calcula con el calendario y la zona horaria del navegador: empieza en su medianoche y termina justo antes de la siguiente. Las capturas de las 00:00 siguientes no se incluyen en la fecha anterior. Se respetan los días de 23 o 25 horas por cambios de horario y se indica su duración. No se permiten fechas posteriores a hoy ni anteriores al primer día guardado.

Al consultar hoy, los gráficos muestran las horas futuras en azul claro, sin solicitar datos futuros ni prolongar conclusiones hacia ellas. Volver al vivo selecciona hoy y los últimos 5 minutos; en vivo el calendario pasa automáticamente al nuevo día al llegar medianoche. El modo histórico mantiene fija la vista. Una consulta completa del día se reutiliza localmente para desplazar o acercar sin repetir la consulta; Actualizar gráficos renueva los datos guardados en memoria. No se conserva esa copia al cerrar el monitor.

El panel **Dónde hay registros** muestra un mapa permanente de todo el día: las marcas verdes representan minutos con mediciones y el recuadro azul es el tramo visible. El mapa no se borra al arrastrar rápidamente las barras ni depende de la consulta del tramo. Se puede pulsar una marca, usar Primera/Última medición, Ajustar a los datos o elegir un tramo con registros. Ver últimos registros salta a la fecha y hora más recientes guardadas, aunque hoy no tenga datos. No hay que conocer de antemano la hora de una prueba.

Los dos agarres del recuadro azul permiten ajustar libremente el inicio y el final del tiempo visible, sin desplazar el extremo contrario. El intervalo mínimo es de 1 minuto y la selección queda dentro del día elegido, incluidos días con cambio de hora. Ambos gráficos, sus barras y la etiqueta del intervalo se actualizan juntos. Durante el arrastre se reutilizan las mediciones disponibles; al soltar se consulta el tramo si no estaba guardado en memoria. Las marcas verdes permanecen visibles. Ajustar manualmente pasa al modo histórico; **Volver al vivo** restaura la actualización automática. Con un extremo enfocado, las flechas ajustan 1 minuto y Mayús + flecha, 15 minutos. Se conservan los intervalos rápidos y los temas claro y oscuro.

`GET /api/chart-coverage?from=...&to=...` agrega los registros por minuto en PostgreSQL para un intervalo diario de hasta 26 horas. Devuelve conteos y tiempos reales, sin fotos ni probabilidades. Incluye todas las mediciones del día aunque el gráfico detallado alcance el límite de 6000 filas. El límite superior del día es exclusivo. La consulta se mantiene al desplazar la vista, se cancela al cambiar de fecha y se completa con IDs nuevos sin contarlos dos veces. Una ventana cubierta por la copia local se dibuja inmediatamente al mover la barra.

El cursor, el toque y las flechas del teclado permiten inspeccionar valores y tramos. Los gráficos conservan las conclusiones registradas, sin recalcularlas con la configuración actual.

`GET /api/chart-history` admite fechas `from` y `to` en milisegundos Unix, sin tope de 24 horas, o una duración positiva `minutes` para iniciar en vivo con la hora del servidor. Rechaza fechas invertidas, futuras y cursores inválidos. Devuelve la primera fecha guardada, la hora del servidor y, si sigue vigente, la conclusión inmediatamente anterior al inicio visible para no dibujar un hueco falso. Añade un índice por cámara y fecha sin borrar datos.

Cada respuesta incluye como máximo 6000 mediciones, sin fotos. Si un intervalo contiene más, lo indica y pide acercar el zoom para ver todo el tramo. El selector permite acceder a cualquier día guardado. En vivo solicita solo IDs nuevos al recibir avisos; si se desconecta el canal, consulta cada 2 segundos. Deduplica filas y elimina las que salen del intervalo. El modo histórico no hace consultas periódicas; Actualizar gráficos conserva el intervalo elegido. Mover la barra cancela la consulta anterior y espera 180 ms antes de cargar el nuevo tramo; ocultar la pestaña suspende las consultas. Los IDs se mantienen como texto para preservar BIGINT. No añade dependencias ni cambia el modelo; el firmware de esta prueba ajusta la cadencia sin cambiar la camara.

Las líneas se interrumpen cuando la separación supera `STALE_AFTER_SECONDS`. El escalón prolonga cada conclusión confirmada hasta la siguiente medición o hasta que venza ese plazo, lo que ocurra antes. La siguiente conclusión No seguro corta la línea inmediatamente. Si se alcanza el límite de 6000 filas, la interfaz lo indica; el propietario puede consultar los registros completos directamente en Aiven.

## 1. Crear o seleccionar la base en Aiven

1. Entra en https://console.aiven.io/ con tu cuenta. Si aún no tienes una, completa el registro personalmente.
2. Si ya tienes un PostgreSQL de Aiven para este proyecto, úsalo; no crees uno duplicado. Para copiar datos antiguos, el destino debe estar vacío de mediciones y estados.
3. Si necesitas crear la base, selecciona **PostgreSQL** y el plan explícitamente marcado **Free / $0**. No elijas un plan de pago amparado solo por créditos de prueba. Comprueba la selección antes de crear el servicio. Si Free no está disponible en tu cuenta, detén ese paso y revisa las opciones.
4. Espera a que el servicio indique que está en ejecución. Abre sus datos de conexión y copia la **Service URI** de PostgreSQL.
5. Descarga su certificado **CA**. Abre el archivo de certificado y copia el bloque completo, desde `-----BEGIN CERTIFICATE-----` hasta `-----END CERTIFICATE-----`, con saltos de línea.
6. La URI y su contraseña se introducen únicamente en las variables privadas de Railway. No las subas a GitHub ni las pegues en el chat. El certificado CA es público, pero su valor debe corresponder al servicio.

No desactives la comprobación TLS para resolver un error. El código verifica la CA y el nombre del servidor. Si hay restricciones de IP en Aiven, revisa el acceso de Railway antes de migrar; no amplíes el acceso de red sin decidirlo expresamente.

## 2. Publicar el código mediante GitHub

1. Descarga y extrae el paquete actualizado en una carpeta aparte. Conserva tu `config.h` local y tus ajustes de WiFi.
2. En tu copia del repositorio `santileonv/camara-basura`, revisa los cambios existentes y reemplaza los archivos de `app` por esta versión. La carpeta del repositorio debe contener `app/package.json` y `app/Dockerfile`; evita crear una carpeta adicional que cambie la raíz `/app`.
3. Revisa el diff antes del commit para conservar cambios propios que hayas realizado desde la versión anterior. No necesitas reemplazar el firmware ni volver a subir el modelo si no han cambiado.
4. No incluyas `.env`, `config.h`, `Config_XIAO_Railway.txt`, contraseñas ni `node_modules`. El paquete limpio tampoco los incluye.
5. Si vas a conservar datos, apaga primero la XIAO y sigue la pausa de recepción descrita en el apartado 3 antes de reanudarla. Un push a la rama conectada puede iniciar automáticamente un despliegue y consumir recursos.
6. Sube el commit a `main` cuando corresponda desplegarlo. Railway debe conservar raíz `/app`, Dockerfile, puerto 3000 y healthcheck `/healthz`.

## 3. Copiar el historial existente sin borrarlo

Este procedimiento mantiene la base original y realiza la copia desde dentro de Railway, donde se puede alcanzar `postgres.railway.internal`. No requiere ejecutar la CLI en tu PC. Durante la operación debes mantener la cámara apagada y la recepción pausada.

### A. Preparar el origen y pausar las capturas

1. Enciende el servicio `Postgres` original en Railway usando su opción de despliegue/reanudación. No lo elimines ni crees otro volumen.
2. En **xiao-monitor → Variables**, conserva por ahora `DATABASE_URL=${{Postgres.DATABASE_URL}}` y añade `INGEST_PAUSED=true`.
3. Publica esta versión y despliega el servidor con esas variables. Espera **SUCCESS**. En los registros debe aparecer `Recepcion de capturas pausada por mantenimiento.`
4. Abre `/healthz` y verifica HTTP 200 con `{"ok":true}`. Conserva un respaldo previo a la migración mediante una herramienta PostgreSQL. Si necesitas una copia completa de la base, conserva también un respaldo PostgreSQL: el JSON de mediciones no reemplaza un `pg_dump`.
5. Revisa el conteo de mediciones y las fechas de las últimas filas. No reanudes la cámara todavía.

### B. Preparar el destino y ejecutar una sola copia

Añade en **Variables del servicio web**:

| Variable | Valor durante la copia |
|---|---|
| `DATABASE_URL` | Mantener `${{Postgres.DATABASE_URL}}`, el origen |
| `INGEST_PAUSED` | `true` |
| `AIVEN_DATABASE_URL` | Service URI privada del PostgreSQL de Aiven |
| `AIVEN_CA_CERT` | Certificado CA completo de Aiven, con sus saltos de línea |

1. En **Settings → Deploy → Pre-deploy Command**, configura `npm run db:copy-to-aiven`. Si el panel ofrece un tiempo límite, usa uno suficiente para tu historial, por ejemplo 600 segundos para este prototipo.
2. Despliega. El paso previo crea las tablas en Aiven y copia cámaras, mediciones y estado. La aplicación seguirá pausada y conectada al origen después de este despliegue.
3. Comprueba en los registros del paso previo el mensaje **`COPIA_AIVEN_OK`** y sus conteos `cameras`, `measurements` y `states`. Si falla, no cambies la conexión: revisa el motivo. El importador se niega a sobrescribir un destino que ya contiene estados o mediciones.
4. Verifica en Aiven que el conteo coincide con el origen y revisa varias filas. No ejecutes de nuevo una copia que ya terminó correctamente; el destino ya estará ocupado.

El origen se lee en una instantánea de solo lectura. La copia de datos del destino es transaccional: si falla antes de confirmar, se revierte. El esquema puede quedar creado y vacío, y la secuencia de IDs puede haberse adelantado ante un fallo final; eso no borra el origen ni crea mediciones parciales. El importador conserva IDs, marcas de tiempo y estado; deja preparada la secuencia para las capturas siguientes.

### C. Cambiar el servidor a Aiven

1. **Borra el contenido del Pre-deploy Command** y guarda. Dejarlo configurado provocaría que una actualización intente copiar de nuevo y se detenga al encontrar datos.
2. Cambia estas variables del servicio web:

| Variable | Valor final |
|---|---|
| `DATABASE_URL` | `${{AIVEN_DATABASE_URL}}` |
| `DATABASE_CA_CERT` | `${{AIVEN_CA_CERT}}` |
| `DATABASE_REQUIRE_TLS` | `true` |
| `INGEST_PAUSED` | `false` |

3. Conserva `AIVEN_DATABASE_URL` y `AIVEN_CA_CERT`: las referencias finales dependen de ellas. Mantén `CAMERA_TOKEN` sin cambios. DASHBOARD_PASSWORD y SESSION_SECRET se usan para el panel privado de administración; no bloquean el monitor público.
4. Despliega y espera **SUCCESS**. Verifica `/healthz`, el historial y el acceso al panel de administración. Los conteos y los valores anteriores deben coincidir.
5. Enciende la XIAO y comprueba `HTTP 200`. Actualiza el historial y confirma que se agregan registros nuevos con IDs posteriores.
6. Solo después de comprobar el traspaso puedes detener el servicio `Postgres` original. Conserva el volumen y un respaldo mientras verificas el funcionamiento; no hace falta eliminarlo para completar la migración.

Si el cambio a Aiven falla antes de aceptar capturas nuevas, vuelve a pausar la recepción y restaura la referencia original de `DATABASE_URL`; elimina las variables TLS aplicables solo a Aiven para esa conexión privada. Si ya hay capturas nuevas en Aiven, no cambies al origen sin reconciliar esos datos: las bases habrán empezado a divergir.

Si no existe historial y quieres empezar vacío, omite la copia y configura directamente Aiven como `DATABASE_URL`, con su CA y TLS obligatorio. El servidor creará las tablas al arrancar. Esa opción no traslada registros anteriores.

## Pausar y continuar desde administración

En `/admin`, el botón **Pausar capturas y análisis** guarda la orden en `camaras.capturas_pausadas`. Es persistente: reiniciar Railway o volver a desplegar no reanuda la cámara. Solo el administrador autenticado puede cambiarla mediante `PUT /api/admin/operations`, protegido por origen, CSRF y versión de configuración. No borra mediciones. Una foto que ya estaba en análisis no puede guardarse después de la pausa; la versión se verifica otra vez en la escritura SQL. Al reanudar, la siguiente captura inicia una ventana de decisión nueva.

**Actualizar una vez la XIAO:** instala la biblioteca WebSockets indicada abajo y copia `XIAO_Remota.ino`, `capture-schedule.h` y `certificados.h` desde `firmware/XIAO_Remota`, conserva tu `config.h` privado y vuelve a cargar la placa. El firmware consulta `/api/device/control` por HTTPS con `CAMERA_TOKEN` antes de capturar al arrancar. En marcha recibe la orden junto a la respuesta del envío; puede haber una foto ya en tránsito, que el servidor descarta sin analizar. Al pausar deja de tomar y enviar las fotos de análisis y consulta la orden cada 3 segundos. Si la vista en vivo también está detenida, desinicializa el controlador de cámara. Si el administrador activó la vista en vivo, solo continúa enviando los cuadros privados de posicionamiento. Al continuar inicializa de nuevo la cámara y retoma la cadencia de demo. No almacena fotos atrasadas. Ante un error de control espera sin capturar hasta recibir una orden válida. La interfaz muestra si la placa confirmó la orden o todavía necesita el firmware nuevo.

Con firmware anterior la pausa del **servidor** funciona: las fotos recibidas no se analizan ni guardan. La toma y el envío físicos solo se detienen con el firmware actualizado. La variable de mantenimiento `INGEST_PAUSED=true`, si estuviera configurada, prevalece y debe retirarse en Railway para reanudar. La vista en vivo privada se controla por separado, como se describe a continuación.

## Dashboard de decisiones y tendencias por hora

El monitor público distingue **Hay basura** (rojo), **Sin basura** (verde), **No seguro** (ámbar), pausa y ausencia de datos (neutros), con texto e indicadores además del color. La tarjeta principal incluye una acción orientativa y la hora de la última medición. Conserva el porcentaje de confianza en la conclusión confirmada y el avance real de capturas y confirmaciones. No cambia el modelo, el promedio ni los umbrales.

Los avisos visuales aparecen al confirmarse un resultado nuevo o cambiar entre basura y sin basura; no se repiten en cada consulta ni se crea un cambio ficticio al abrir una conclusión ya guardada. Los resultados sin confirmar y la información antigua no generan avisos de basura. El botón **Sonido** está desactivado al abrir la página y solo activa tonos locales mediante una acción del usuario. No se envían correos, mensajes ni notificaciones externas; los avisos funcionan mientras la página está abierta. Al pausar, perder datos o volver a un resultado incierto se oculta un aviso anterior para evitar confusiones.

**Tendencias por hora** usa la misma fecha que los gráficos y resume el día completo, independientemente del zoom del gráfico. Presenta porcentajes y cantidades de mediciones con conclusiones Hay basura, Sin basura y No seguro; la hora con más mediciones clasificadas como Hay basura; una distribución de cada franja horaria; y las últimas confirmaciones o cambios del día. Al pulsar una hora con datos, los dos gráficos se sitúan en ese intervalo. Respeta los días de 23 o 25 horas por cambios de hora; las horas futuras y sin registros se muestran sin asignarles una conclusión.

Los porcentajes del resumen son **proporciones de mediciones guardadas**, calculadas sobre todos sus registros, incluidos los No seguro. No son el porcentaje de tiempo con basura, una cantidad de objetos ni volumen de residuos. La hora destacada se elige por **número de mediciones con Hay basura**, por lo que una mayor actividad de la cámara puede influir. En cambio, el porcentaje de confianza de la tarjeta principal y de cada confirmación histórica conserva su significado como puntuación del modelo.

`GET /api/decision-trends?from=...&to=...` consulta como máximo 26 horas, con inicio inclusivo y final exclusivo. Agrega en PostgreSQL todas las mediciones de la cámara, sin el límite de 6000 filas del gráfico ni fotografías. Totales y cambios salen del mismo snapshot SQL. La respuesta contiene solo agregados horarios y hasta ocho confirmaciones/cambios; no expone claves ni permite modificar datos. La consulta usa el índice existente por cámara y fecha y no requiere migraciones. El frontend se actualiza al recibir una captura nueva, agrupa avisos cercanos y suspende las consultas al ocultar la página. Cambiar de fecha cancela la consulta anterior para no mostrar datos de otro día.

Pruebas: más de 6000 registros, medianoche excluida, categorías y proporciones, días de 23/25 horas, fechas inválidas/futuras, lectura HTTP pública acotada, avisos duplicados y fuera de orden, sonido optativo y respuestas tardías al cambiar de fecha. No requiere volver a cargar el firmware.

## Video continuo privado para posicionar la cámara

En `/admin`, **Iniciar video** abre una transmisión MJPEG continua. La XIAO mantiene un enlace WSS con Railway y envía video a un objetivo de **12 fps**, a **320×240** y calidad JPEG 18. El servidor lo retransmite por una conexión MJPEG permanente al navegador. La frecuencia y el retraso reales dependen del WiFi, de Internet y del tiempo de análisis: 12 fps es un objetivo del firmware, no una medición de la cámara física. El panel indica los fps recibidos por el servidor.

El envío antiguo de una imagen por petición HTTPS quedó retirado. Los cuadros nuevos comparten una conexión TLS y usan un máximo de tres cuadros pendientes de confirmación; si la red se congestiona, la XIAO espera para tomar un cuadro reciente en vez de acumular una grabación. Los espectadores lentos descartan cuadros. Solo se conserva el último cuadro en RAM.

Para posicionar con la mayor fluidez, pulsa **Pausar capturas y análisis**, inicia el video, ajusta la posición, detén el video y reanuda la detección. Los controles son independientes: el video no cambia la pausa persistente. Con la detección activa, sus envíos siguen teniendo prioridad y pueden interrumpir brevemente el movimiento. Cada captura de análisis conserva **800×600 y calidad JPEG 12**; el sensor vuelve a esos ajustes y vacía los cuadros del tamaño anterior antes de enviar la medición. El giro elegido en el formulario se refleja en el video; **Guardar cambios** lo aplica al análisis.

El video se muestra exclusivamente en **Zona que analizará el modelo**, bajo el recuadro editable. Los botones **Iniciar video / Detener video** y su estado están integrados en ese apartado. No hay otro visor superior ni otra solicitud de video del navegador. El recuadro y sus controles conservan el borrador de la zona y el giro seleccionados. Las consultas de la última medición no sustituyen el video por una foto, aunque la detección esté pausada. Al detener el video vuelve a mostrarse la última captura disponible, sin descartar los ajustes sin guardar. El diseño se adapta al tamaño de la ventana sin reiniciar el enlace.

El video está apagado por defecto. Activarlo requiere una sesión administrativa, origen y CSRF válidos. La autorización se renueva cada 5 segundos, vence tras 15 segundos sin renovación y tiene un máximo de 5 minutos. Mover la ventana entre pantallas o cambiar de pestaña no revoca el video que el usuario inició. Se mantiene la renovación mientras el navegador lo permita. Si la conexión o la autorización temporal se pierden, al volver a la ventana se reconecta automáticamente dentro del límite original de cinco minutos, sin quitarle el control a otra sesión. Cerrar la página, cerrar sesión o pulsar **Detener video** sí lo detienen; una vista detenida manualmente no se vuelve a activar sola.

La placa usa el protocolo de control **3**, verifica el certificado TLS con `certificados.h` y se conecta de forma saliente a `/api/device/video` con `CAMERA_TOKEN` en una cabecera. No hay puertos locales abiertos ni claves en el navegador. Una conexión de placa por instancia; máximo 200 000 bytes por cuadro. Las órdenes de pausa y versión de configuración viajan también por WSS y la placa confirma su aplicación. El servidor no ejecuta el modelo ni guarda fotos o mediciones de video en PostgreSQL; tampoco las envía al monitor público.

`/api/admin/live/stream` exige sesión administrativa vigente, con cookies privadas y cabeceras que impiden almacenamiento. Comprueba la sesión durante la transmisión y cierra una vista revocada. Los protocolos 1 y 2 siguen admitiendo pausa remota; el protocolo 2 recibe `IDLE` para no activar la vista lenta anterior. `/api/device/preview` devuelve 410: es necesario actualizar el firmware para ver el video continuo.

**Instalación en Arduino IDE:**

1. En el gestor de bibliotecas instala **WebSockets**, de **Markus Sattler**, versión **2.7.2**.
2. Descarga el repositorio y abre `firmware/XIAO_Remota/XIAO_Remota.ino`. Conserva tu `config.h` privado junto a `capture-schedule.h` y `certificados.h`.
3. Selecciona **XIAO_ESP32S3**, **OPI PSRAM** y **USB CDC habilitado**, y carga el programa. La plantilla `config.example.h` no reemplaza tus valores privados.
4. Abre `/admin`, inicia sesión y pulsa **Iniciar video**. El firmware anterior no basta para esta transmisión.

No se incorporan servicios externos ni suscripciones. El video usa el servidor Railway existente y consume tráfico y recursos solo mientras está activo.

## 4. Administrar la base y descargar los datos

En Aiven abre tu servicio PostgreSQL y **PG Studio**. Ahí puedes consultar las tablas y ejecutar SQL. Para este proyecto:

```sql
SELECT count(*) AS total FROM public.mediciones;
SELECT * FROM public.mediciones ORDER BY id DESC LIMIT 100;
SELECT pg_size_pretty(pg_database_size(current_database())) AS tamano_base;
```

Desde `/admin` → **Exportar datos** puedes descargar:

- **Base en JSON:** contenido de las tres tablas del proyecto (`camaras`, `estado_camara`, `mediciones`), metadatos de formato y fecha. Conserva IDs y secuencias BIGINT como texto y los timestamps de mediciones con precisión de microsegundos. No incluye contraseñas ni variables de Railway. No es un `pg_dump`: no contiene definiciones SQL, roles ni permisos.
- **Mediciones en CSV:** todas las columnas numéricas, identidad y fecha de cada medición; incluye cabecera y BOM UTF-8 para hojas de cálculo.

Puedes elegir todo el historial o fechas inclusivas de inicio y término, en la zona horaria del navegador. El filtro afecta las mediciones; el JSON mantiene la configuración y el estado actuales de las cámaras. La descarga usa una instantánea PostgreSQL de solo lectura y lotes de 500 filas, sin cargar el historial completo en memoria. Solo se permite una exportación simultánea por instancia, con límite de dos minutos; ante un volumen mayor, elige menos días. Cerrar sesión corta una descarga todavía en curso. Cancelarla cierra la transacción y libera la conexión. No necesita pausar el análisis.

Para un respaldo PostgreSQL completo con esquema y permisos, usa `pg_dump` de forma privada. PG Studio de Aiven también permite exportar resultados de consultas.

Se guardan resultados numéricos de cada captura aceptada y solo la última miniatura en `estado_camara`. Los registros numéricos no pueden recuperar fotos históricas que nunca se almacenaron.

## 5. Cámara y WiFi

1. Abre `firmware/XIAO_Remota/XIAO_Remota.ino` en Arduino IDE.
2. Copia `config.example.h` como `config.h` en la misma carpeta.
3. Completa estos cuatro valores:

```cpp
static const char *WIFI_SSID = "NOMBRE_DE_TU_WIFI";
static const char *WIFI_PASSWORD = "CONTRASENA_DE_TU_WIFI";
static const char *SERVER_URL = "https://TU_DOMINIO_REAL.up.railway.app/api/ingest";
static const char *CAMERA_TOKEN = "MISMO_TOKEN_CONFIGURADO_EN_RAILWAY";
```

4. Usa una red WiFi de **2,4 GHz** con acceso a Internet.
5. Selecciona la placa **XIAO_ESP32S3**, **OPI PSRAM** y **USB CDC On Boot: Enabled**. El sketch mantiene la cámara y los pines de la versión anterior, orientada a Arduino-ESP32 3.3.x.
6. Carga el sketch y abre el monitor serie a **115200 baudios**.
7. Espera la conexión WiFi y la sincronización de hora por NTP. La hora permite validar el certificado HTTPS.
8. Comprueba que aparezca `HTTP 200`, seguido del resultado enviado por el servidor.

El envío contiene JPEG binario, un token y un identificador de captura. La conexión comprueba el certificado y el nombre del servidor; no usa `setInsecure()`.

El WiFi sigue configurándose en `config.h`. Esta entrega no implementa todavía un portal para seleccionar redes desde el teléfono o la página remota.

## 6. Lógica de detección

1. La cámara obtiene una imagen de **800 × 600** y la envía por HTTPS.
2. El servidor gira la imagen y recorta la zona guardada por el administrador (por defecto, el cuadrado central de **600 × 600**), la reduce a **224 × 224** y aplica la misma normalización del modelo de Teachable Machine.
3. El modelo entrega las probabilidades de **Sin basura**, **Botellas**, **Papeles y Cartones** y **Bolsas**.
4. El sistema suma Botellas + Papeles y Cartones + Bolsas. Así, un objeto puede alternar entre clases de residuos sin impedir la conclusión conjunta.
5. En demo promedia hasta 3 capturas, empieza a evaluar con 3 y exige 2 confirmaciones. En stable conserva 5 capturas y 3 confirmaciones. La pagina indica el perfil y los limites correspondientes.
6. Con umbral de 80 %, concluye **Hay basura** si el promedio conjunto es ≥80 %, **Sin basura** si es ≤20 % y **No seguro** en la zona intermedia o durante la confirmación.

La barra principal muestra la confianza estimada en la conclusión confirmada: el promedio de basura para **Hay basura**, o `1 − promedio de basura` para **Sin basura**. Por ejemplo, un promedio de basura del 10 % se presenta como 90 % de confianza de que no hay basura. Para **No seguro**, datos vencidos o un cambio de orientación pendiente, no se muestra un porcentaje de confianza. El panel de la última captura presenta solo dos barras: **Sin basura** y **Hay basura**. Esta última usa `trashNow`, la suma de Botellas + Papeles y Cartones + Bolsas calculada en el servidor; no promedia las tres clases ni utiliza el promedio temporal. Debajo se muestra por separado el promedio móvil que sustenta la conclusión. Estas puntuaciones del modelo no son una garantía de acierto ni una medida de cantidad de residuos.
7. El nuevo estado y la medición se guardan juntos en PostgreSQL. Si falla la escritura, no se da por guardado un estado parcial.

Con evidencia consistente, la primera conclusion llega en la cuarta captura en demo y en la quinta en stable. Un reinicio de la camara, un corte largo, un cambio de perfil, de zona, de giro o de umbral reinician la ventana de confirmacion. Refrescar la web no añade mediciones.

En demo el objetivo es un ciclo completo de **5 segundos**, incluyendo el trabajo y la espera restante. Si el trabajo supera ese tiempo, el siguiente ciclo comienza al terminar, sin solapamientos. Con DEMO_MODE=false se restaura la pausa de **15 segundos despues de terminar cada envio**. El video de posicionamiento solo se transmite cuando el administrador lo activa; permanece apagado durante el uso habitual. Si un envío falla, la cámara espera al menos 30 segundos antes de otra captura; no almacena una cola de fotos perdidas durante un corte.

Si pasan 90 segundos sin una lectura, el monitor indica **Sin datos recientes**. El historial anterior sigue disponible. Los porcentajes son puntuaciones de clasificación; no expresan volumen, cantidad de objetos ni una medición física de basura.

## 7. Variables y archivos nuevos

| Archivo o variable | Función |
|---|---|
| `lib/raw-export.js` | Lee todas las mediciones por lotes en una instantánea de solo lectura |
| `api/export.js` | Handler público retirado; responde 404 y no lee la base |
| `api/admin-export.js` / `lib/database-export.js` | Exportación JSON/CSV privada y por lotes |
| `api/operations.js` / `lib/device-status.js` | Pausa persistente y confirmación de la placa |
| `public/admin-tools.js` | Controles de operación y exportación del administrador |
| `lib/live-preview.js` / `api/live-preview.js` | Autorización temporal y transmisión MJPEG privada en RAM |
| `lib/device-video.js` | Enlace WSS continuo autenticado, límites, créditos y órdenes de control |
| `public/admin-live.js` | Video y encuadre en vivo, renovación y reconexión al cambiar de pantalla |
| `api/camera-settings.js` | Ruta pública de ajuste retirada; devuelve 410. Los cambios se hacen por /api/admin/settings |
| `lib/database.js` | Pool de cinco conexiones y verificación TLS con CA para Aiven |
| `scripts/copy-to-aiven.js` | Copia única del PostgreSQL actual al destino Aiven |
| `scripts/import-history.js` | Importador general: `SOURCE_DATABASE_URL` → `DATABASE_URL` |
| `SOURCE_DATABASE_CA_CERT` | CA opcional del origen cuando usa el importador general |
| `INGEST_PAUSED` | Detiene temporalmente el análisis y guardado de nuevas capturas |

La base original sigue siendo compatible: añadir JSON no obliga a migrar a Aiven. El certificado del destino no se aplica por accidente al origen: cada conexión usa su propia configuración TLS.

## 8. Desarrollo y pruebas

Requiere Node 22. Desde `app`:

```bash
npm ci
npm test
npm run check-model
```

Para ejecutar el servidor localmente, copia `.env.example` como `.env`, completa las variables con una conexión PostgreSQL accesible desde tu equipo y usa `NODE_ENV=development` para HTTP local:

```bash
npm run dev
```

Abre `http://localhost:3000`. Para producción mantén `NODE_ENV=production` y HTTPS. El monitor público no necesita cookies ni clave de consulta.

Las pruebas de video comprueban autenticación, CSRF, caducidad, revocación, límites de tamaño y frecuencia, una secuencia de 24 cuadros reales sobre un solo enlace, recepción MJPEG privada, cambios de pausa por WSS, protocolos compatibles y cierre al salir de la página. Las pruebas de interfaz comprueban además visibilidad, foco, reconexión, límite original de cinco minutos y video bajo el recuadro sin perder el borrador. La prueba de secuencia simula la placa; no mide sus fps físicos ni su WiFi.

Las pruebas usan PostgreSQL compilado a WebAssembly mediante PGlite: no necesitan tus credenciales ni escriben en tus bases de nube. Incluyen ejecución real del modelo con un JPEG sintético, recorrido HTTP, consulta pública, orientación fija, rutas públicas de modificación y exportación retiradas, pausa y reanudación privadas, carreras de pausa durante el análisis y el commit, exportación privada por lotes con BIGINT y filtros de fechas, revocación de descargas, registro atómico, duplicados, paginación, copia de más de 250 registros y reversión ante fallos. La imagen sintética comprueba ejecución; no mide la precisión con basura real.

El paquete no incluye `node_modules`. Docker instala solo dependencias de producción con `npm ci`. El firmware de video continuo se compila con Arduino-ESP32 3.3.13 y WebSockets 2.7.2. La compilación no sustituye la prueba de la cámara física.

## 9. Librerías y funciones clave

| Elemento | Uso |
|---|---|
| `@tensorflow/tfjs` 4.22.0 | Inferencia del modelo en CPU en el servidor. |
| `sharp` 0.35.5 | Validación JPEG, recorte, reducción y miniatura. |
| `pg` 8.23.1 | Pool de conexiones y consultas parametrizadas PostgreSQL. |
| `@electric-sql/pglite` 0.5.16 | PostgreSQL para las pruebas de desarrollo. |
| `node:http`, `node:crypto`, `node:fs` | Servidor, firma de sesión y lectura de archivos; incluidos en Node. |
| `WiFi`, `esp_camera`, `esp_http_client`, `time` | Red, cámara, HTTPS y hora; incluidos en el entorno Arduino-ESP32. |
| `loadModel()` / `classify()` | Carga una vez el modelo por proceso y analiza imágenes. |
| `decide()` | Obtiene la conclusión conjunta y aplica las confirmaciones. |
| `saveReading()` / `readHistory()` | Guarda una captura y recupera páginas de historial. |
| `migrate()` | Prepara las tablas al arrancar con bloqueo de migración. |
| `importHistory()` | Copia datos PostgreSQL sin modificar el origen. |
| `CAPTURE_INTERVAL_MS` | Pausa estable de la XIAO; 15000 ms. En DEMO_MODE=true se usa el objetivo total DEMO_CYCLE_MS=5000. |
| `DETECTION_PROFILE` | demo (3 capturas / 2 confirmaciones) o stable (5 / 3), en Railway. |
| `DEMO_MODE` | true para ciclo total de 5 s, false para la pausa estable; se cambia en el firmware y se vuelve a cargar. |
| `THRESHOLD` / `STALE_AFTER_SECONDS` | Umbral de decisión y antigüedad máxima de una lectura actual. |

## 10. Operación y resolución de problemas

| Síntoma | Qué comprobar |
|---|---|
| `DATABASE_CA_CERT` ausente | Referencia a `AIVEN_CA_CERT` y certificado PEM completo |
| Error de certificado TLS | CA del servicio correcto, nombre del host y fecha del certificado; no usar `rejectUnauthorized:false` |
| HTTP 503 al enviar fotos | `INGEST_PAUSED=false`, salud de Aiven y registros del servidor |
| Fallo del paso previo en nuevos despliegues | Retirar `npm run db:copy-to-aiven` después de la primera copia correcta |
| Copia rechazada por destino ocupado | Confirmar si ya terminó; no vaciar datos para forzar una repetición |
| Exportación web devuelve HTTP 404 | Es intencional: la descarga se retiró del monitor público |
| No aparece el botón de giro | Es intencional: la rotación está fijada en 180 grados |
| Más de 90 s sin datos | Revisar alimentación, WiFi de 2,4 GHz, servicio Railway y base Aiven |
| `sta is connecting` | Evitar iniciar conexiones WiFi repetidas mientras la conexión anterior sigue en curso |

Para detener el sistema: apaga la XIAO y detén el servicio web. Si ya usa Aiven, detener el Postgres viejo de Railway no detiene la base nueva. Conserva respaldos y revisa los recursos que siguen asignados: un servicio offline no equivale necesariamente a costo total cero, especialmente si conserva almacenamiento o un plan contratado. Un push a la rama conectada puede volver a desplegar el servidor.

Aiven Free tiene límites y condiciones de disponibilidad; comprueba el plan actual en tu consola. Trasladar la base no vuelve gratuito el análisis en Railway. El historial sigue creciendo con cada captura; esta actualización no borra registros ni aplica retención automática.

Documentación oficial:

- Conexión Node.js y CA de Aiven: https://aiven.io/docs/products/postgresql/howto/connect-node
- SSL en node-postgres: https://node-postgres.com/features/ssl
- PG Studio: https://aiven.io/docs/products/postgresql/howto/pg-studio
- Variables de Railway: https://docs.railway.com/guides/variables
- Comandos previos al despliegue: https://docs.railway.com/guides/pre-deploy-command

## Publicar la version correcta

Los controles de fecha, graficos y modo demo estan en `main`. El 21 de noviembre se detecto un despliegue manual de una imagen antigua (commit `312d03e`, PR #6) mientras `main` ya incluia los PR #9 y #10. El codigo no se habia perdido: Railway estaba sirviendo otra version.

Para actualizar, desplegar el ultimo commit de `main` y comprobar que el despliegue termina en SUCCESS. Reiniciar o redeployar una entrada antigua del historial puede volver a publicar esa imagen antigua. Despues de publicar, recargar la pagina. Esta correccion web no requiere volver a cargar el firmware que ya funciona en la XIAO.
