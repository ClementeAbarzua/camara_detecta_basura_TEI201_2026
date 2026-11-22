# Datos de las pruebas

Datos exportados de la base de datos PostgreSQL (Aiven) durante las pruebas.

> [PENDIENTE: exportar la tabla de detecciones a CSV y guardarla aquí, por ejemplo `detecciones_2026-11-22.csv`.]
> Desde Aiven o desde cualquier cliente SQL: `SELECT * FROM <tabla> ORDER BY <fecha>;` → exportar como CSV.

| Archivo | Descripción |
|---|---|
| `detecciones_AAAA-MM-DD.csv` | Registro de cada detección: fecha y hora, resultado y porcentaje de confianza |
