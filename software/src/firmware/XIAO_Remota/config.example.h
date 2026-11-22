#pragma once
// Copia este archivo como config.h y completa los cuatro valores.
// config.h esta excluido de Git para no publicar tus claves.
static const char *WIFI_SSID = "NOMBRE_DE_TU_WIFI";
static const char *WIFI_PASSWORD = "CONTRASENA_DE_TU_WIFI";
static const char *SERVER_URL = "https://xiao-monitor-production.up.railway.app/api/ingest";
// Debe ser identico a CAMERA_TOKEN en las variables del servicio web de Railway.
static const char *CAMERA_TOKEN = "COPIA_AQUI_EL_TOKEN_DE_32_CARACTERES_O_MAS";
// Pausa estable DESPUES de cada envio. Con DEMO_MODE=true se usa un ciclo total de 5000 ms.
static constexpr uint32_t CAPTURE_INTERVAL_MS = 15000;
