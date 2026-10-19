/*
  XIAO ESP32-S3 Sense / OV3660. Modelo: 1er entrenamiento.
  Arduino-ESP32 3.3.0. Placa: XIAO_ESP32S3.
  PSRAM: OPI PSRAM. USB CDC On Boot: Enabled. Flash: 8 MB.
  Partition Scheme: Maximum APP (7.9MB APP No OTA/No FS).

  Escribe WIFI_SSID y WIFI_PASSWORD debajo. Red de 2.4 GHz.
  La direccion web aparece en el monitor serie a 115200 baudios.
  El navegador ejecuta el modelo. La placa sirve video, fotos y todos
  los archivos del modelo/bibliotecas desde flash. No necesita Internet,
  tarjeta SD, carga de LittleFS ni bibliotecas extra.

  Abre este .ino desde su carpeta completa: assets.h debe estar al lado.
  Conserva los ajustes de imagen del sketch usado para entrenar.
*/
#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "assets.h"

#if !defined(ARDUINO_PARTITION_max_app_8MB)
#error "Selecciona Herramientas > Partition Scheme > Maximum APP (7.9MB APP No OTA/No FS). Si no aparece, instala esp32 by Espressif Systems 3.3.0."
#endif

// =============================================================
// EDITA SOLO ESTAS DOS LINEAS CON LOS DATOS DE TU RED WIFI:
// Conserva las comillas. Para una red abierta, usa password = "".
// =============================================================
static const char *WIFI_SSID = "iPhone de Santiago";
static const char *WIFI_PASSWORD = "12345678";

static constexpr uint32_t WIFI_RETRY_MS = 20000;
static constexpr uint32_t WIFI_STATUS_MS = 30000;
static bool networkConfigured = false;
static bool wifiWasConnected = false;
static uint32_t lastWifiAttempt = 0;
static uint32_t lastWifiStatus = 0;
static IPAddress lastIPAddress;
static httpd_handle_t webServer = nullptr;
static httpd_handle_t videoServer = nullptr;
static SemaphoreHandle_t cameraMutex;
static bool cameraReady = false;

static esp_err_t assetHandler(httpd_req_t *req) {
  const WebAsset *asset = static_cast<const WebAsset *>(req->user_ctx);
  httpd_resp_set_type(req, asset->contentType);
  httpd_resp_set_hdr(req, "Cache-Control", asset->cacheControl);
  if (asset->gzip) httpd_resp_set_hdr(req, "Content-Encoding", "gzip");
  // Enviar directamente desde flash en bloques; no copiar el modelo a RAM.
  for (size_t offset = 0; offset < asset->size; offset += 4096) {
    const size_t remaining = asset->size - offset;
    const size_t count = remaining < 4096 ? remaining : 4096;
    esp_err_t err = httpd_resp_send_chunk(req,
      reinterpret_cast<const char *>(asset->data + offset), count);
    if (err != ESP_OK) return err;
  }
  return httpd_resp_send_chunk(req, nullptr, 0);
}

static esp_err_t captureHandler(httpd_req_t *req) {
  if (!cameraReady || xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(6000)) != pdTRUE) {
    httpd_resp_set_status(req, "503 Service Unavailable");
    return httpd_resp_send(req, "Camara no disponible. Revisa OPI PSRAM y el monitor serie.", HTTPD_RESP_USE_STRLEN);
  }
  // Descartar un cuadro: cada peticion obtiene una captura nueva.
  camera_fb_t *fb = esp_camera_fb_get();
  if (fb) esp_camera_fb_return(fb);
  fb = esp_camera_fb_get();
  if (!fb) {
    xSemaphoreGive(cameraMutex);
    return httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "No se pudo capturar");
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  esp_err_t result = httpd_resp_send(req, reinterpret_cast<const char *>(fb->buf), fb->len);
  esp_camera_fb_return(fb);
  xSemaphoreGive(cameraMutex);
  return result;
}

static esp_err_t streamHandler(httpd_req_t *req) {
  if (!cameraReady) return httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Camara no disponible");
  httpd_resp_set_type(req, "multipart/x-mixed-replace;boundary=xiaoframe");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  while (true) {
    if (xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(6000)) != pdTRUE) return ESP_FAIL;
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) { xSemaphoreGive(cameraMutex); return ESP_FAIL; }
    char header[100];
    const int n = snprintf(header, sizeof(header),
      "\r\n--xiaoframe\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", static_cast<unsigned>(fb->len));
    esp_err_t result = httpd_resp_send_chunk(req, header, n);
    if (result == ESP_OK) result = httpd_resp_send_chunk(req, reinterpret_cast<const char *>(fb->buf), fb->len);
    esp_camera_fb_return(fb);
    xSemaphoreGive(cameraMutex);
    if (result != ESP_OK) return result;
    // Dejar tiempo para capturas de clasificacion y fotos. FPS no garantizados.
    vTaskDelay(pdMS_TO_TICKS(150));
  }
}

static esp_err_t initCamera() {
  if (!psramFound()) {
    Serial.println("ERROR: activa OPI PSRAM en Herramientas.");
    return ESP_FAIL;
  }
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0; c.ledc_timer = LEDC_TIMER_0;
  c.pin_d0 = 15; c.pin_d1 = 17; c.pin_d2 = 18; c.pin_d3 = 16;
  c.pin_d4 = 14; c.pin_d5 = 12; c.pin_d6 = 11; c.pin_d7 = 48;
  c.pin_xclk = 10; c.pin_pclk = 13; c.pin_vsync = 38; c.pin_href = 47;
  c.pin_sccb_sda = 40; c.pin_sccb_scl = 39;
  c.pin_pwdn = -1; c.pin_reset = -1;
  c.xclk_freq_hz = 20000000; c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size = FRAMESIZE_SVGA; c.jpeg_quality = 12;
  c.fb_count = 2; c.fb_location = CAMERA_FB_IN_PSRAM;
  c.grab_mode = CAMERA_GRAB_LATEST;
  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) return err;
  sensor_t *sensor = esp_camera_sensor_get();
  if (sensor && sensor->id.PID == OV3660_PID) {
    sensor->set_vflip(sensor, 1);
    sensor->set_brightness(sensor, 1);
    sensor->set_saturation(sensor, -2);
  }
  return ESP_OK;
}

static void startServers() {
  httpd_config_t cfg = HTTPD_DEFAULT_CONFIG();
  cfg.server_port = 80; cfg.stack_size = 8192;
  cfg.max_uri_handlers = 12;
  cfg.send_wait_timeout = 10; cfg.recv_wait_timeout = 10;
  cfg.lru_purge_enable = true;
  ESP_ERROR_CHECK(httpd_start(&webServer, &cfg));
  for (size_t i = 0; i < WEB_ASSET_COUNT; ++i) {
    httpd_uri_t route = {};
    route.uri = WEB_ASSETS[i].uri; route.method = HTTP_GET;
    route.handler = assetHandler;
    route.user_ctx = const_cast<WebAsset *>(&WEB_ASSETS[i]);
    ESP_ERROR_CHECK(httpd_register_uri_handler(webServer, &route));
  }
  httpd_uri_t capture = {};
  capture.uri = "/capture"; capture.method = HTTP_GET; capture.handler = captureHandler;
  ESP_ERROR_CHECK(httpd_register_uri_handler(webServer, &capture));
  // El video usa otro servidor para no bloquear las capturas de deteccion.
  cfg.server_port = 81; cfg.ctrl_port += 1;
  cfg.send_wait_timeout = 3;
  ESP_ERROR_CHECK(httpd_start(&videoServer, &cfg));
  httpd_uri_t stream = {};
  stream.uri = "/stream"; stream.method = HTTP_GET; stream.handler = streamHandler;
  ESP_ERROR_CHECK(httpd_register_uri_handler(videoServer, &stream));
}

static void maintainWiFi() {
  if (!networkConfigured) return;
  const uint32_t now = millis();
  if (WiFi.status() == WL_CONNECTED) {
    const IPAddress ip = WiFi.localIP();
    if (!wifiWasConnected || ip != lastIPAddress) {
      wifiWasConnected = true;
      lastIPAddress = ip;
      lastWifiStatus = now;
      Serial.printf("\nWiFi conectado: %s\n", WIFI_SSID);
      Serial.printf("Abre http://%s\n", ip.toString().c_str());
      Serial.printf("Senal WiFi: %ld dBm\n", static_cast<long>(WiFi.RSSI()));
      Serial.println("Conecta el PC o celular al mismo router y usa una sola pestana.");
    } else if (now - lastWifiStatus >= WIFI_STATUS_MS) {
      // Repetir la IP para poder verla al abrir el monitor despues del arranque.
      lastWifiStatus = now;
      Serial.printf("WiFi activo. Abre http://%s | Senal %ld dBm\n",
        ip.toString().c_str(), static_cast<long>(WiFi.RSSI()));
    }
    return;
  }
  if (wifiWasConnected) {
    wifiWasConnected = false;
    lastWifiAttempt = now;
    Serial.println("WiFi desconectado. Intentando reconexion automatica...");
  }
  // El controlador hace reconexion automatica. Este intento adicional evita
  // quedarse sin reintentos si el router no estaba disponible al arrancar.
  if (now - lastWifiAttempt >= WIFI_RETRY_MS) {
    lastWifiAttempt = now;
    Serial.printf("Reintentando WiFi: %s | Estado %d\n", WIFI_SSID, static_cast<int>(WiFi.status()));
    if (!WiFi.reconnect()) Serial.println("No inicio este intento; se reintentara en 20 segundos.");
  }
}

void setup() {
  Serial.begin(115200); delay(800);
  if (strlen(WIFI_SSID) == 0 || strcmp(WIFI_SSID, "NOMBRE_DE_TU_WIFI") == 0 ||
      strcmp(WIFI_PASSWORD, "CONTRASENA_DE_TU_WIFI") == 0) {
    Serial.println("CONFIGURACION PENDIENTE: escribe WIFI_SSID y WIFI_PASSWORD al inicio del sketch.");
    Serial.println("Luego vuelve a subir el codigo. No se ha iniciado una red propia.");
    return;
  }
  cameraMutex = xSemaphoreCreateMutex();
  if (!cameraMutex) { Serial.println("Sin memoria para iniciar camara"); return; }
  const esp_err_t err = initCamera();
  cameraReady = (err == ESP_OK);
  Serial.printf("Inicio camara: 0x%x\n", static_cast<unsigned>(err));
  WiFi.setHostname("xiao-camara");
  if (!WiFi.mode(WIFI_STA)) {
    Serial.println("ERROR al iniciar el modo cliente WiFi."); return;
  }
  WiFi.setAutoReconnect(true);
  // Evitar el ahorro del modem para reducir latencia durante la transmision.
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  networkConfigured = true;
  lastWifiAttempt = millis();
  // Los servidores escuchan en todas las interfaces. Siguen disponibles
  // cuando el router asigna una IP o la placa recupera la conexion.
  startServers();
  Serial.printf("Conectando a WiFi: %s\n", WIFI_SSID);
  Serial.println("Esperando IP. Reintentos cada 20 segundos si hace falta.");
  Serial.println("Modelo listo para el navegador. No necesita Internet.");
}

void loop() {
  maintainWiFi();
  delay(250);
}
