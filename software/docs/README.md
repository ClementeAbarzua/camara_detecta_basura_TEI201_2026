# Documentación técnica del software

## Modelo de clasificación

- **Herramienta:** Teachable Machine (Google), modelo de imagen.
- **Clases:** Sin basura, Botellas, Papeles y Cartones, Bolsas.
- **Datos de entrenamiento:** fotos propias tomadas con la misma cámara XIAO y con los mismos ajustes de imagen que usa el firmware. Están en `iteraciones/iteracion_2/Modelo/Fotos Entrenamiento/`.

## Regla de decisión

Problema encontrado en la iteración 2: con objetos que no estaban en el entrenamiento, el modelo repartía la probabilidad entre las clases de basura. Ninguna clase llegaba sola al 80 %, así que el sistema nunca concluía nada.

Solución (en `web_fuentes/app.js`):

1. Por cada captura: `basura = P(Botellas) + P(Papeles y Cartones) + P(Bolsas)`.
2. Se guardan las últimas **5** probabilidades de basura y, con al menos **3**, se calcula el promedio.
3. Si el promedio ≥ umbral (80 % por defecto, ajustable en la página) → candidato "Hay basura". Si `1 − promedio` ≥ umbral → candidato "Sin basura".
4. El veredicto solo cambia cuando el mismo candidato se repite en **3** evaluaciones consecutivas.

Así el sistema responde a la pregunta que importa para el problema (¿hay basura acumulada?) sin depender de reconocer el tipo exacto de residuo.
