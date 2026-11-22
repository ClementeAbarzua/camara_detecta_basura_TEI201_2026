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
- La placa se conecta en modo estación a una red WiFi, con reconexión automática cada 20 s.
- Código fuente comentado por secciones (carpeta `Codigo Fuente - Comentado/`, copiado como versión final a `software/src/firmware/`).
- Regla de decisión por suma de clases de basura y promedio de las últimas 5 capturas.
- Servidor en Railway con base de datos PostgreSQL (Aiven) y dashboard web: https://xiao-monitor-production.up.railway.app/

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
