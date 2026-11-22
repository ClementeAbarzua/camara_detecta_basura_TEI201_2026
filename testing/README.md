# Testing y validación

## Objetivo

Comprobar que el sistema detecta la presencia de basura de forma confiable y lo bastante rápido como para que la información sirva para decidir cuándo limpiar un punto crítico (problema del Avance #1).

## Carpetas

| Carpeta | Contenido |
|---|---|
| `reportes/` | Protocolo de pruebas ([`protocolo_pruebas.md`](reportes/protocolo_pruebas.md)) |
| `datos/` | Exportación de la base de datos desde `/admin`: `mediciones-xiao-2026-11-22.csv` (2.488 mediciones) y respaldo JSON |
| `evidencias/` | Capturas del dashboard durante las pruebas |

## Resultados (datos reales del 14 al 22 de noviembre de 2026)

Calculados a partir de `datos/mediciones-xiao-2026-11-22.csv`.

| Métrica | Resultado | Criterio | ¿Cumple? |
|---|---|---|---|
| Mediciones registradas | **2.488** fotos analizadas en 6 días de pruebas, 17 encendidos de la cámara | — | — |
| Tiempo de análisis en el servidor | mediana **0,36 s** por foto (90 % bajo 0,53 s) | < 2 s | ✅ |
| Intervalo entre fotos | **5,0 s** en modo demo (21–22 nov); ~19 s en modo estable (14–20 nov) | 5 s / 15–20 s | ✅ |
| Tiempo hasta confirmar **"Hay basura"** | mediana **15 s** (mín. 10 s, máx. 25 s), 6 eventos | ≤ 30 s | ✅ |
| Tiempo hasta confirmar **"Sin basura"** al retirar | mediana **17,5 s** (mín. 10 s, máx. 55 s), 6 eventos | ≤ 30 s | ⚠️ 1 caso lento |
| Lecturas "No seguro" (modo demo) | **15 %** de las mediciones | lo más bajo posible | — |
| Persistencia | todas las mediciones quedaron guardadas en Aiven y se exportaron sin pérdidas | sin pérdida | ✅ |

**Cómo se midió el tiempo de confirmación:** desde la primera foto en que el modelo ya veía el cambio (suma de basura ≥ 80 % al poner el objeto, o ≤ 20 % al retirarlo) hasta la primera medición con la conclusión confirmada. Como hay una foto cada 5 s, el tiempo real desde que se pone el objeto puede ser hasta 5 s mayor.

**Qué no se midió:** la exactitud del modelo contra un registro manual de lo que había frente a la cámara (matriz de confusión). Los porcentajes del dashboard son puntuaciones del clasificador, no una exactitud demostrada.

## Fallas encontradas y soluciones

| Falla | Causa | Solución |
|---|---|---|
| Con objetos no entrenados el sistema nunca concluía | La probabilidad se repartía entre clases y ninguna llegaba sola al 80 % | Sumar las tres clases de basura y promediar varias fotos |
| Una lectura dudosa se mostraba como "Sin basura" | Solo existían dos estados | Se agregó el estado **"No seguro"** entre 20 % y 80 % |
| Con ~19 s entre fotos, confirmar un cambio tomaba más de un minuto | Promedio de 5 fotos y 3 confirmaciones en modo estable | **Modo demo**: foto cada 5 s, promedio de 3 y 2 confirmaciones → ~15 s |
| Al retirar la basura, un caso tardó 55 s en volver a "Sin basura" | Lecturas intermedias ("No seguro") reiniciaban las confirmaciones | Pendiente: ajustar la zona de análisis o el umbral desde `/admin` según la instalación |

## Conexión con el problema

El sistema detecta la aparición de basura y la confirma en unos **15 segundos**, sin que nadie tenga que ir al lugar. El resumen por hora del dashboard muestra a qué horas aparece la basura (por ejemplo, el 21 de noviembre la hora con más registros "Hay basura" fue las 15:00). Con esa información, el equipo municipal puede programar el retiro en vez de esperar un reclamo vecinal.
