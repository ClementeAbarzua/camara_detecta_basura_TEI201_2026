# Software

## Carpetas

| Carpeta | Contenido |
|---|---|
| `src/firmware/XIAO_Remota/` | **Firmware final** de la XIAO ESP32-S3 Sense: captura fotos y las envía por HTTPS al servidor |
| `src/servidor/` | **Servidor y dashboard** en Railway: analiza las fotos con el modelo, guarda en PostgreSQL (Aiven) y muestra el monitor |
| `src/firmware/XIAO_Deteccion_WiFi/` | Versión anterior (iteración 3, Avance #2): el modelo corría en el navegador y no guardaba datos |
| `librerias/` | Librerías y versiones |
| `docs/` | Regla de decisión, modo demo y documentación detallada del servidor |

## Ciclo de datos

```
XIAO ESP32-S3 Sense ──HTTPS (JPEG 800×600)──► Servidor Railway (Node.js)
                                                │ gira, recorta la zona y escala a 224×224
                                                │ modelo Teachable Machine (TensorFlow.js)
                                                │ regla de decisión
                                                ▼
                                        PostgreSQL en Aiven (tabla mediciones)
                                                │
                                                ▼
                         Dashboard público (en vivo) + panel /admin
```

1. **Captura:** la cámara toma una foto JPEG de 800 × 600 cada **5 s** (modo demo) o cada **15 s más el tiempo de envío** (modo estable).
2. **Envío:** la placa la manda por HTTPS a `/api/ingest` con un token. Solo hace conexiones salientes, así que no hay que abrir puertos del router.
3. **Análisis:** el servidor gira la imagen, recorta la zona configurada y el modelo calcula la probabilidad de cada clase: Sin basura, Botellas, Papeles y Cartones, Bolsas.
4. **Decisión:** suma de las tres clases de basura, promediada en las últimas 3 capturas (demo) o 5 (estable). Con el umbral de 80 %: ≥ 80 % propone "Hay basura", ≤ 20 % propone "Sin basura" y lo intermedio es "No seguro". El resultado se confirma tras 2 (demo) o 3 (estable) evaluaciones seguidas.
5. **Almacenamiento:** cada medición se guarda en PostgreSQL de Aiven con fecha y hora, probabilidades, promedio, umbral y conclusión.
6. **Visualización:** el dashboard muestra el estado actual, el avance de la decisión, el gráfico "¿Hay basura?" en el tiempo, el gráfico de probabilidad con los umbrales y el historial.

## Por qué esta frecuencia

Un microbasural se forma en horas, así que en operación normal basta una foto cada 15 s (modo estable): ahorra batería, datos y créditos del servidor. Para la demo se usa un ciclo de 5 s, que confirma un cambio en unos 15–20 s. En ambos modos, exigir varias lecturas seguidas evita falsas alarmas cuando una persona o un auto pasa frente a la cámara.

## Cómo usarlo

Ver las instrucciones en el [README principal](../README.md#️-instrucciones-de-uso).
