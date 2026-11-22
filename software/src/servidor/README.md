# Servidor y dashboard

> ⚠️ **PENDIENTE:** subir aquí el código del servidor que está desplegado en Railway.
> Archivos esperados: `server.js`, `package.json`, la carpeta de la página del dashboard (`public/`) y un `.env.example`.
> **Nunca subir el archivo `.env`**: contiene la contraseña de la base de datos (ya está en `.gitignore`).

**Dashboard en vivo:** https://xiao-monitor-production.up.railway.app/

## Arquitectura

- **Railway:** aloja el servidor Express y la página del dashboard. Se despliega solo con cada push a GitHub.
- **Aiven (PostgreSQL):** guarda cada detección para tener un histórico persistente.
- Basado en la guía del curso "ESP32 conectado a una base de datos en la nube — Aiven + Railway + GitHub" (ver `FUENTES.md`).

## Ejecutar localmente

```bash
npm install
cp .env.example .env    # y completar DATABASE_URL con los datos de Aiven
npm start
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de conexión a PostgreSQL de Aiven |
| `PORT` | Puerto del servidor (Railway lo asigna solo) |
