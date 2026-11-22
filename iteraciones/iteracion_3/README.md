# Iteración 3 — Sistema IoT completo

## Información general

**Fecha:** 23/11/2026
**Estado:** Prototipo IoT completo
**Avance asociado:** Avance #3

## Objetivos de esta iteración

- Conectar la cámara a una red WiFi externa en lugar de su propia red.
- Guardar las detecciones en una base de datos en la nube y mostrarlas en un dashboard.
- Diseñar una carcasa nueva, reparable y con todos los componentes integrados.

## Cambios respecto a la iteración 2

### Hardware
- Interruptor deslizante para apagar la batería sin abrir la carcasa.

### Software
- Primero, la placa pasó a conectarse a una red WiFi externa con reconexión automática (versión guardada en `software/src/firmware/XIAO_Deteccion_WiFi/`).
- Después, el análisis pasó de la placa y el navegador **a la nube**: el firmware final `XIAO_Remota` envía cada foto por HTTPS a un servidor en Railway, que ejecuta el modelo y guarda el resultado en PostgreSQL (Aiven). El sistema sigue detectando aunque nadie tenga la página abierta.
- Regla de decisión: suma de clases de basura, promedio móvil, estado "No seguro" y confirmaciones seguidas.
- Dashboard público con estado en vivo, gráficos históricos e historial, más un panel `/admin` para el umbral, la zona de análisis, el giro, la pausa, el video y la exportación de datos: https://xiao-monitor-production.up.railway.app/
- Código en `software/src/firmware/XIAO_Remota/` y `software/src/servidor/`.

### Diseño mecánico
- Carcasa nueva "LA CARCASA" de 77 × 58 × 30 mm, en dos mitades unidas con tornillos sobre insertos de bronce.
- Aberturas para el lente, el USB-C y el interruptor, más ranuras de ventilación.
- Gemelo 3D con todos los componentes y plano técnico (ver `diseno_3d/`).

## Problemas identificados

- [PENDIENTE: completar con lo encontrado en las pruebas finales (ver `testing/`).]

## Trabajo futuro

- Carcasa resistente a la lluvia para instalación en exterior.
- Medidor de carga de la batería visible en el dashboard.
- Estimación del volumen de basura acumulada, no solo de su presencia.
- Más puntos de monitoreo y un mapa de puntos críticos en el dashboard.
