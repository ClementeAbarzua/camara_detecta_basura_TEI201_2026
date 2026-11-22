# Protocolo de pruebas

## Prueba 1 — Exactitud de la detección

**Objetivo:** medir qué porcentaje de las veces el sistema decide correctamente "Hay basura" o "Sin basura".

**Condiciones:**
- Lugar: [PENDIENTE: sala / exterior], iluminación [PENDIENTE: natural / artificial].
- Cámara en el trípode a [PENDIENTE] m del suelo y [PENDIENTE] m de la zona observada.
- Umbral configurado en 80 %, perfil `demo` (foto cada 5 s, promedio de 3, 2 confirmaciones).

**Procedimiento:**
1. Encender el dispositivo y abrir el dashboard.
2. Con la escena vacía, esperar el veredicto y anotar el resultado.
3. Poner un objeto (botella, bolsa, cartón u objeto no entrenado) y esperar el veredicto.
4. Retirar el objeto y esperar el veredicto.
5. Repetir con [PENDIENTE: N] objetos distintos, [PENDIENTE: M] veces cada uno.

**Criterio de éxito:** exactitud ≥ 80 %.

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

**Resultados:** promedio [PENDIENTE] s, mínimo [PENDIENTE] s, máximo [PENDIENTE] s.

## Prueba 3 — Operación continua y persistencia

**Objetivo:** confirmar que el sistema funciona de forma continua y que los datos quedan guardados.

**Procedimiento:** dejar el dispositivo funcionando [PENDIENTE] minutos con batería. Luego revisar en la base de datos que no haya vacíos en los registros y exportarlos a `testing/datos/`.

**Criterio de éxito:** sin desconexiones y con registros continuos en la base de datos.

**Resultados:** [PENDIENTE]

## Fallas encontradas

| Falla | Causa | Solución | Evidencia |
|---|---|---|---|
| El modelo no concluía con objetos no entrenados | La probabilidad se repartía entre clases y ninguna llegaba al 80 % | Suma de clases de basura + promedio de 5 capturas | `software/docs/README.md` |
| [PENDIENTE] | | | |
