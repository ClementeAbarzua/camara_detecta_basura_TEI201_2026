# Datos de las pruebas

Exportados desde el panel `/admin` del dashboard (base de datos PostgreSQL en Aiven) el 22 de noviembre de 2026.

| Archivo | Descripción |
|---|---|
| `mediciones-xiao-2026-11-22.csv` | 2.488 filas, una por foto analizada (14–22 nov): fecha y hora, probabilidad de cada clase, suma de basura actual y promedio, umbral, capturas promediadas, confirmaciones, conclusión y tiempo de análisis |
| `base-xiao-2026-11-22.json` | Respaldo de las tablas `camaras`, `estado_camara` y `mediciones`. No contiene contraseñas ni variables de entorno |

Los resultados calculados con estos datos están en [`testing/README.md`](../README.md).
