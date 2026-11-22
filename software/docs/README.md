# Documentación técnica del software

| Archivo | Contenido |
|---|---|
| Este README | Modelo de clasificación y regla de decisión |
| [`MODO_DEMO_Y_REVERSION.md`](MODO_DEMO_Y_REVERSION.md) | Diferencias entre el modo demo (5 s) y el estable (15 s), y cómo volver atrás |
| [`servidor_detalle.md`](servidor_detalle.md) | Documentación completa del servidor: administración, gráficos, seguridad, migración a Aiven |

## Modelo de clasificación

- **Herramienta:** Teachable Machine (Google), modelo de imagen.
- **Clases:** Sin basura, Botellas, Papeles y Cartones, Bolsas.
- **Datos de entrenamiento:** fotos propias tomadas con la misma cámara XIAO (`iteraciones/iteracion_2/Modelo/Fotos Entrenamiento/`).
- **Dónde corre:** en el servidor de Railway (`software/src/servidor/model/`), con TensorFlow.js. Entrada: recorte de la zona de análisis escalado a 224 × 224.

## Regla de decisión

**Problema encontrado en la iteración 2:** con objetos que no estaban en el entrenamiento, el modelo repartía la probabilidad entre las clases de basura. Ninguna llegaba sola al 80 %, así que el sistema nunca concluía.

**Solución** (`software/src/servidor/lib/decision.js`):

1. Por cada foto: `basura = P(Botellas) + P(Papeles y Cartones) + P(Bolsas)`.
2. Se promedian las últimas **3** fotos (modo demo) o **5** (modo estable). Se necesitan al menos 3 para evaluar.
3. Con umbral de 80 %: promedio ≥ 80 % → candidato **Hay basura**; promedio ≤ 20 % → candidato **Sin basura**; entre ambos → **No seguro**.
4. El resultado se confirma cuando el mismo candidato se repite en **2** evaluaciones seguidas (demo) o **3** (estable).
5. El umbral se ajusta entre 60 % y 95 % desde `/admin` y queda guardado en la base de datos.

Así el sistema responde a la pregunta que importa para el problema (¿hay basura acumulada?) sin depender de reconocer el tipo exacto de residuo. Además, no confunde una lectura dudosa con "Sin basura".
