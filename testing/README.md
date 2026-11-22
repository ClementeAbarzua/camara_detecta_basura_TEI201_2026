# Testing y validación

## Objetivo

Comprobar que el sistema detecta correctamente la presencia de basura y que la información que genera sirve para decidir cuándo limpiar un punto crítico (problema del Avance #1).

## Carpetas

| Carpeta | Contenido |
|---|---|
| `reportes/` | Protocolo de pruebas y resultados ([`protocolo_pruebas.md`](reportes/protocolo_pruebas.md)) |
| `datos/` | Datos exportados de la base de datos (CSV) y tablas de resultados |
| `evidencias/` | Capturas del dashboard y fotos de las pruebas |

## Resumen de resultados

| Métrica | Resultado | Criterio de éxito |
|---|---|---|
| Exactitud de detección (hay / no hay basura) | [PENDIENTE] % | ≥ 80 % |
| Tiempo desde que aparece la basura hasta la alerta | [PENDIENTE] s | ≤ 10 s |
| Falsos positivos con escena vacía | [PENDIENTE] de [N] | 0 |
| Pérdidas de conexión durante la prueba continua | [PENDIENTE] | 0 |

## Falla principal encontrada y solución

**Falla:** con objetos que no estaban en el entrenamiento, el modelo repartía la probabilidad entre las tres clases de basura. Ninguna superaba el 80 % y el sistema nunca concluía.

**Solución:** sumar las tres clases de basura y promediar las últimas 5 capturas antes de comparar con el umbral (ver `software/docs/README.md`). Con este cambio, el sistema concluye "Hay basura" también con residuos distintos a los entrenados.

## Conexión con el problema

[PENDIENTE: completar con los resultados. Ejemplo: "En N pruebas, el sistema detectó la basura en X de Y casos, con la alerta en Z segundos. Con esto, un equipo municipal se entera de un microbasural nuevo sin esperar un reclamo vecinal".]
