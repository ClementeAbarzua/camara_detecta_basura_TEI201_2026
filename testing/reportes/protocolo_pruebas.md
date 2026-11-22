# Protocolo de pruebas

## Prueba 1 — Exactitud de la detección

**Objetivo:** medir qué porcentaje de las veces el sistema decide correctamente "Hay basura" o "Sin basura".

**Condiciones:**
- Lugar: sala de taller, con iluminación interior.
- Cámara montada en el trípode, apuntando al escenario de prueba; zona de análisis ajustada desde `/admin`.
- Umbral configurado en 80 %, perfil `demo` (foto cada 5 s, promedio de 3, 2 confirmaciones).

**Procedimiento:**
1. Encender el dispositivo y abrir el dashboard.
2. Con la escena vacía, esperar el veredicto y anotar el resultado.
3. Poner un objeto (botella, bolsa, cartón u objeto no entrenado) y esperar el veredicto.
4. Retirar el objeto y esperar el veredicto.
5. Repetir con distintos objetos (botellas, bolsas, papeles y cartones, y objetos no entrenados), varias veces cada uno.

**Criterio de éxito:** exactitud ≥ 80 %.

> Esta prueba requiere anotar a mano qué había frente a la cámara en cada intento. Las pruebas del 21 y 22 de noviembre se registraron en la base de datos, pero sin ese registro manual, por lo que la exactitud no está calculada. La tabla queda como plantilla para la siguiente iteración.

**Resultados:**

| Objeto | Intentos | Correctos | Exactitud |
|---|---|---|---|
| Escena vacía | | | |
| Botella | | | |
| Bolsa | | | |
| Papel / cartón | | | |
| Objeto no entrenado | | | |
| **Total** | | | |

## Prueba 2 — Latencia de la alerta

**Objetivo:** medir cuánto tarda el dashboard en mostrar "Hay basura" desde que se pone el objeto.

**Procedimiento:** poner el objeto, iniciar un cronómetro y detenerlo cuando cambie el estado en el dashboard. Repetir 10 veces.

**Criterio de éxito:** promedio ≤ 30 s (en modo demo se esperan unos 15–20 s: hacen falta 4 fotos de 5 s para confirmar).

**Resultados (calculados desde la base de datos, 21–22 nov, modo demo):** "Hay basura" se confirmó con una mediana de 15 s (mín. 10 s, máx. 25 s, 6 eventos); "Sin basura" al retirar, con una mediana de 17,5 s (mín. 10 s, máx. 55 s, 6 eventos). Cumple el criterio salvo un caso de retiro.

## Prueba 3 — Operación continua y persistencia

**Objetivo:** confirmar que el sistema funciona de forma continua y que los datos quedan guardados.

**Procedimiento:** dejar el dispositivo funcionando de forma continua. Luego revisar en la base de datos que no haya vacíos en los registros y exportarlos a `testing/datos/`.

**Criterio de éxito:** sin desconexiones y con registros continuos en la base de datos.

**Resultados:** 2.488 mediciones registradas entre el 14 y el 22 de noviembre en 17 encendidos de la cámara, exportadas a `testing/datos/` sin pérdidas. Intervalo mediano de 5,0 s entre fotos en modo demo. Tiempo de análisis mediano de 0,36 s por foto.

## Fallas encontradas

| Falla | Causa | Solución | Evidencia |
|---|---|---|---|
| El modelo no concluía con objetos no entrenados | La probabilidad se repartía entre clases y ninguna llegaba al 80 % | Suma de clases de basura + promedio de 5 capturas | `software/docs/README.md` |
| Un retiro tardó 55 s en volver a "Sin basura" | Lecturas intermedias reiniciaban las confirmaciones | Ajustar zona de análisis o umbral desde `/admin` | `testing/datos/mediciones-xiao-2026-11-22.csv` |
