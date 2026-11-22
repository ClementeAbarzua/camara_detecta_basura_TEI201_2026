# Historial de iteraciones

Esta carpeta documenta cómo evolucionó el prototipo durante el semestre.

| Aspecto | Iteración 1 | Iteración 2 | Iteración 3 |
|---|---|---|---|
| **Fecha** | 23/09/2026 | 19/10/2026 | 23/11/2026 |
| **Avance** | Planificación / Avance #1 | Avance #2 | Avance #3 |
| **Objetivo** | Ver la imagen de la cámara en un navegador | Detectar basura con Machine Learning | Sistema IoT completo con nube y dashboard |
| **Red** | Red propia de la XIAO (modo AP) | Red propia y luego WiFi externa | WiFi externa con reconexión automática |
| **Alimentación** | USB-C | Batería LiPo 4.6 Wh | Batería + interruptor |
| **Detección** | — | Teachable Machine, 4 clases | Suma de clases + promedio de 5 capturas |
| **Datos** | Solo en vivo | Solo en vivo | Guardados en PostgreSQL (Aiven) + dashboard en Railway |
| **Carcasa** | — | Prisma hexagonal (86 × 60 × 22 mm) | "LA CARCASA" atornillada (77 × 58 × 30 mm) |

## Carpetas

- [`iteracion_1/`](iteracion_1/): código para ver la cámara en el navegador.
- [`iteracion_2/`](iteracion_2/): fotos de entrenamiento, modelo de Teachable Machine y primeros firmwares con detección.
- [`iteracion_3/`](iteracion_3/): código fuente comentado de la versión final.
