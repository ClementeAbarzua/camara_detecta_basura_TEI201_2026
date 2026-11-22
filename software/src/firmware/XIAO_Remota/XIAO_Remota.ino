/* XIAO ESP32-S3 Sense / OV3660: envia JPEG por HTTPS a Railway.
 * Arduino-ESP32 3.3.x. Placa XIAO_ESP32S3, OPI PSRAM, USB CDC Enabled.
 * Completa config.h. Monitor serie 115200. No requiere assets.h ni SD.
 * El modelo se ejecuta en Railway. La placa hace conexiones salientes:
 * no hay que abrir puertos del router ni mantener un PC conectado.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h> // WebSockets 2.7.2, Markus Sattler (gestor de bibliotecas).
#include "esp_camera.h"
#include "esp_http_client.h"
#include "esp_system.h"
#include <time.h>
#include "certificados.h"
#include "capture-schedule.h"
#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif

// Poner false para restaurar la pausa original de CAPTURE_INTERVAL_MS.
static constexpr bool DEMO_MODE = true;
static constexpr uint32_t DEMO_CYCLE_MS = 5000;

static bool configured = false, wifiWasConnected = false;
static uint32_t lastWifiAttempt = 0, lastClockWarning = 0, nextCapture = 0, sequence = 0;
static char bootId[17];
// La pausa se confirma antes de capturar al arrancar. En marcha llega con la respuesta HTTPS.
static bool capturePaused = true, controlReady = false, cameraInitialized = false;
static uint32_t lastControlAttempt = 0;
static String controlVersion = "0", controlURL, videoHost;
static bool previewRequested = false;
static uint32_t nextPreview = 0, videoRetryAt = 0, videoStateAt = 0, videoAckAt = 0;
static uint32_t videoSent = 0, videoAcked = 0;
static uint16_t videoPort = 443;
static bool videoReady = false, videoCamera = false, videoClosing = false, videoFailed = false;
static WebSocketsClient *videoClient = nullptr;
static constexpr uint32_t VIDEO_FRAME_MS = 83; // Objetivo 12 fps; se adapta a red y créditos.
static constexpr uint32_t VIDEO_MAX_PENDING = 3; // Sin cola de cuadros antiguos.
struct HttpReply { String text; int paused = -1; int preview = -1; String version; };
static bool validVersion(const String &value) {
  if (!value.length() || value.length() > 19) return false;
  for (size_t i = 0; i < value.length(); ++i) if (value[i] < '0' || value[i] > '9') return false;
  return true;
}

// Se conservan los pines, resolucion y ajustes de tu version funcional.
static esp_err_t initCamera() {
  if (!psramFound()) { Serial.println("ERROR: activa OPI PSRAM."); return ESP_FAIL; }
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
  esp_err_t result = esp_camera_init(&c);
  if (result != ESP_OK) return result;
  sensor_t *sensor = esp_camera_sensor_get();
  if (sensor && sensor->id.PID == OV3660_PID) {
    sensor->set_vflip(sensor, 1);
    sensor->set_brightness(sensor, 1);
    sensor->set_saturation(sensor, -2);
  }
  return ESP_OK;
}

static esp_err_t onHttpEvent(esp_http_client_event_t *event) {
  HttpReply *response = static_cast<HttpReply *>(event->user_data);
  if (!response) return ESP_OK;
  if (event->event_id == HTTP_EVENT_ON_HEADER && event->header_key && event->header_value) {
    if (strcasecmp(event->header_key, "X-Capture-Paused") == 0)
      response->paused = strcmp(event->header_value, "1") == 0 ? 1 : strcmp(event->header_value, "0") == 0 ? 0 : -1;
    if (strcasecmp(event->header_key, "X-Control-Version") == 0) response->version = event->header_value;
    if (strcasecmp(event->header_key, "X-Preview-Active") == 0)
      response->preview = strcmp(event->header_value, "1") == 0 ? 1 : strcmp(event->header_value, "0") == 0 ? 0 : -1;
  }
  if (event->event_id == HTTP_EVENT_ON_DATA && event->data_len > 0) {
    const size_t room = response->text.length() < 768 ? 768 - response->text.length() : 0;
    const size_t count = static_cast<size_t>(event->data_len) < room ? event->data_len : room;
    if (count) response->text.concat(static_cast<const char *>(event->data), count);
  }
  return ESP_OK;
}

static void closePreviewClient() {
  videoClosing = true;
  if (videoClient) { videoClient->disconnect(); delete videoClient; videoClient = nullptr; }
  videoClosing = false; videoReady = false; videoSent = videoAcked = 0;
}

// Se cambia solo el video; cada análisis conserva 800x600 y calidad JPEG 12.
static bool cameraVideoMode(bool video) {
  if (!cameraInitialized || videoCamera == video) return cameraInitialized;
  sensor_t *sensor = esp_camera_sensor_get();
  if (!sensor || sensor->set_framesize(sensor, video ? FRAMESIZE_QVGA : FRAMESIZE_SVGA) != 0 ||
      sensor->set_quality(sensor, video ? 18 : 12) != 0) {
    // No reutilizar un sensor que quedó configurado a medias.
    esp_camera_deinit(); cameraInitialized = false; videoCamera = false; return false;
  }
  videoCamera = video;
  // Vaciar los dos cuadros que aún pueden pertenecer al tamaño anterior.
  for (int i=0; i<2; i++) { camera_fb_t *old = esp_camera_fb_get(); if (old) esp_camera_fb_return(old); }
  return true;
}

static void onVideoEvent(WStype_t type, uint8_t *payload, size_t length) {
  if (type == WStype_CONNECTED) {
    videoSent = videoAcked = 0; videoReady = false; videoAckAt = millis();
    Serial.println("Enlace de video continuo conectado. Esperando orden autenticada...");
  } else if (type == WStype_DISCONNECTED) {
    videoReady = false;
    if (!videoClosing) { controlReady = false; videoFailed = true; }
  } else if (type == WStype_TEXT) {
    if (length > 128) { videoFailed = true; return; }
    String message; message.concat(reinterpret_cast<const char *>(payload), length);
    if (message.startsWith("ACK\n")) {
      String value = message.substring(4); value.trim();
      if (!validVersion(value) || value.length() > 9) { videoFailed = true; return; }
      const uint32_t ack = strtoul(value.c_str(), nullptr, 10);
      if (ack < videoAcked || ack > videoSent) { videoFailed = true; return; }
      videoAcked = ack; videoAckAt = millis();
    } else if (message.startsWith("STATE\n")) {
      const int separator = message.indexOf('\n', 6);
      String command = message.substring(6, separator < 0 ? 6 : separator);
      String version = separator < 0 ? String("") : message.substring(separator + 1); version.trim();
      if ((command != "RUN" && command != "PAUSE") || !validVersion(version)) { videoFailed = true; return; }
      capturePaused = command == "PAUSE"; controlVersion = version; controlReady = true;
      videoStateAt = millis(); videoReady = true;
      const String status = String("STATUS\n") + command + "\n" + controlVersion + "\n";
      videoClient->sendTXT(status.c_str());
    } else videoFailed = true;
  } else if (type == WStype_ERROR) videoFailed = true;
}

static void beginVideo() {
  if (videoClient || static_cast<int32_t>(millis() - videoRetryAt) < 0) return;
  videoFailed = false;
  videoClient = new WebSocketsClient();
  videoClient->beginSslWithCA(videoHost.c_str(), videoPort, "/api/device/video", TRUSTED_ROOTS, "xiao-video");
  const String headers = String("Authorization: Bearer ") + CAMERA_TOKEN +
    "\r\nX-Control-Protocol: 3\r\nX-Device-Mode: " + (capturePaused ? "paused" : "running") +
    "\r\nX-Control-Version: " + controlVersion + "\r\nX-Preview-Mode: active";
  videoClient->setExtraHeaders(headers.c_str());
  videoClient->setReconnectInterval(2000);
  videoClient->onEvent(onVideoEvent);
}

static void deviceHeaders(esp_http_client_handle_t client) {
  const String authorization = String("Bearer ") + CAMERA_TOKEN;
  esp_http_client_set_header(client, "Authorization", authorization.c_str());
  esp_http_client_set_header(client, "X-Control-Protocol", "3");
  esp_http_client_set_header(client, "X-Device-Mode", capturePaused ? "paused" : "running");
  esp_http_client_set_header(client, "X-Control-Version", controlVersion.c_str());
  esp_http_client_set_header(client, "X-Preview-Mode", previewRequested ? "active" : "idle");
}

// Video MJPEG continuo sobre WSS: un enlace permanente, no un POST por cuadro.
static bool sendPreview(camera_fb_t *frame) {
  if (!videoClient || !videoReady || frame->width != 320 || frame->height != 240 || frame->len > 200000) return false;
  if (videoSent - videoAcked >= VIDEO_MAX_PENDING) return false;
  const bool sent = videoClient->sendBIN(frame->buf, frame->len);
  if (sent) { if (videoSent == videoAcked) videoAckAt = millis(); videoSent++; }
  else videoFailed = true;
  return sent;
}

// Sin video, la pausa se consulta cada 3 s. Durante el video llega por WSS.
static bool readControl() {
  HttpReply response;
  esp_http_client_config_t config = {};
  config.url = controlURL.c_str(); config.method = HTTP_METHOD_GET;
  config.cert_pem = TRUSTED_ROOTS; config.timeout_ms = 10000;
  config.disable_auto_redirect = true; config.event_handler = onHttpEvent; config.user_data = &response;
  esp_http_client_handle_t client = esp_http_client_init(&config);
  if (!client) return false;
  deviceHeaders(client);
  const esp_err_t result = esp_http_client_perform(client);
  const int status = esp_http_client_get_status_code(client);
  esp_http_client_cleanup(client);
  const int separator = response.text.indexOf('\n');
  String command = response.text.substring(0, separator < 0 ? 0 : separator);
  const int second = separator < 0 ? -1 : response.text.indexOf('\n', separator + 1);
  String version = second < 0 ? String("") : response.text.substring(separator + 1, second); version.trim();
  String live = second < 0 ? String("") : response.text.substring(second + 1); live.trim();
  if (result != ESP_OK || status != 200 || (command != "RUN" && command != "PAUSE") || !validVersion(version) || (live != "PREVIEW" && live != "IDLE")) {
    Serial.printf("No se pudo consultar la pausa (HTTP %d). Reintentando sin capturar...\n", status);
    return false;
  }
  const bool paused = command == "PAUSE";
  if (!controlReady || paused != capturePaused) Serial.println(paused ? "Deteccion pausada por el administrador." : "Deteccion reanudada.");
  capturePaused = paused; controlVersion = version; controlReady = true;
  const bool requested = live == "PREVIEW";
  if (requested != previewRequested) Serial.println(requested ? "Vista en vivo privada activada." : "Vista en vivo detenida.");
  previewRequested = requested;
  if (!previewRequested) closePreviewClient();
  return true;
}

// HTTPS verifica certificado y nombre del servidor mediante certificados.h.
static bool sendPhoto(camera_fb_t *frame) {
  HttpReply response; response.text.reserve(768);
  esp_http_client_config_t config = {};
  config.url = SERVER_URL;
  config.method = HTTP_METHOD_POST;
  config.cert_pem = TRUSTED_ROOTS;
  config.timeout_ms = 25000;
  config.disable_auto_redirect = true;
  config.event_handler = onHttpEvent; config.user_data = &response;
  esp_http_client_handle_t client = esp_http_client_init(&config);
  if (!client) { Serial.println("No se pudo crear el cliente HTTPS."); return false; }
  const String authorization = String("Bearer ") + CAMERA_TOKEN;
  const String frameNumber = String(++sequence);
  esp_http_client_set_header(client, "Authorization", authorization.c_str());
  // El servidor recibe el JPEG como cuerpo binario, sin codificarlo en base64.
  esp_http_client_set_header(client, "Content-Type", "application/octet-stream");
  esp_http_client_set_header(client, "X-Camera-Boot", bootId);
  esp_http_client_set_header(client, "X-Frame-Seq", frameNumber.c_str());
  deviceHeaders(client);
  esp_http_client_set_post_field(client, reinterpret_cast<const char *>(frame->buf), frame->len);
  const uint32_t started = millis();
  const esp_err_t result = esp_http_client_perform(client);
  const int status = esp_http_client_get_status_code(client);
  Serial.printf("Captura %lu | JPEG %u bytes | HTTP %d | %lu ms\n",
    static_cast<unsigned long>(sequence), static_cast<unsigned>(frame->len), status,
    static_cast<unsigned long>(millis() - started));
  if (result != ESP_OK) Serial.printf("Error de conexion HTTPS: %s\n", esp_err_to_name(result));
  else Serial.println(response.text);
  if (result == ESP_OK && status == 200 && response.paused >= 0 && validVersion(response.version)) {
    const bool paused = response.paused == 1;
    if (paused && !capturePaused) Serial.println("Pausa recibida: se detienen las capturas de analisis; el video privado es independiente.");
    capturePaused = paused; controlVersion = response.version; controlReady = true;
    previewRequested = response.preview == 1;
  } else controlReady = false;
  if (status == 401 || status == 403) Serial.println("Revisa CAMERA_TOKEN y que la URL de produccion permita acceso a la API.");
  if (status >= 300 && status < 400) Serial.println("Redireccion inesperada: usa la URL HTTPS de produccion terminada en /api/ingest.");
  esp_http_client_cleanup(client);
  return result == ESP_OK && status == 200;
}

void setup() {
  Serial.begin(115200); delay(800);
  if (!strlen(WIFI_SSID) || strcmp(WIFI_SSID, "NOMBRE_DE_TU_WIFI") == 0 ||
      strcmp(WIFI_PASSWORD, "CONTRASENA_DE_TU_WIFI") == 0 ||
      strstr(SERVER_URL, "TU_PROYECTO") || strncmp(SERVER_URL, "https://", 8) != 0 ||
      strstr(CAMERA_TOKEN, "COPIA_AQUI") || strlen(CAMERA_TOKEN) < 32 || CAPTURE_INTERVAL_MS < 5000) {
    Serial.println("CONFIGURACION PENDIENTE: copia config.example.h como config.h y completa WiFi, URL y token. Intervalo minimo: 5000 ms.");
    return;
  }
  String serverURL(SERVER_URL);
  if (!serverURL.endsWith("/api/ingest")) { Serial.println("SERVER_URL debe terminar en /api/ingest."); return; }
  controlURL = serverURL.substring(0, serverURL.length() - strlen("/api/ingest")) + "/api/device/control";
  const int authorityEnd = serverURL.indexOf('/', 8);
  String authority = serverURL.substring(8, authorityEnd);
  const int colon = authority.indexOf(':');
  if (colon >= 0) {
    const long port = authority.substring(colon + 1).toInt();
    if (port < 1 || port > 65535) { Serial.println("Puerto HTTPS invalido."); return; }
    videoPort = static_cast<uint16_t>(port); videoHost = authority.substring(0, colon);
  } else videoHost = authority;
  const esp_err_t result = initCamera();
  if (result != ESP_OK) { Serial.printf("Error de camara: 0x%x\n", static_cast<unsigned>(result)); return; }
  cameraInitialized = true;
  snprintf(bootId, sizeof(bootId), "%08lx%08lx", static_cast<unsigned long>(esp_random()), static_cast<unsigned long>(esp_random()));
  WiFi.setHostname("xiao-remota"); WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true); WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD); lastWifiAttempt = millis();
  // La hora correcta permite verificar la vigencia de los certificados HTTPS.
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  configured = true;
  Serial.println("Conectando a Internet. El analisis ocurre en Railway.");
}

void loop() {
  if (!configured) { delay(250); return; }
  const uint32_t now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiWasConnected) { wifiWasConnected = false; controlReady = false; closePreviewClient(); Serial.println("WiFi desconectado. Reconectando..."); }
    if (now - lastWifiAttempt >= 20000) { WiFi.reconnect(); lastWifiAttempt = now; }
    delay(100); return;
  }
  if (!wifiWasConnected) {
    wifiWasConnected = true;
    Serial.printf("WiFi conectado. IP local %s. El monitor remoto usa la URL de Railway.\n", WiFi.localIP().toString().c_str());
  }
  if (time(nullptr) < 1700000000) {
    if (now - lastClockWarning > 15000) { lastClockWarning = now; Serial.println("Esperando hora de Internet (NTP) para HTTPS..."); }
    delay(100); return;
  }
  if (videoClient && previewRequested) videoClient->loop();
  if (videoClient && (videoFailed || (videoReady && millis() - videoStateAt > 5000) ||
      (videoSent > videoAcked && millis() - videoAckAt > 3000))) {
    closePreviewClient(); controlReady = false; videoRetryAt = millis() + 2000;
  }
  if (!previewRequested) closePreviewClient();
  if (capturePaused && !previewRequested && cameraInitialized) {
    esp_camera_deinit(); cameraInitialized = false; videoCamera = false;
  }
  if (!controlReady || (capturePaused && !videoReady)) {
    const uint32_t controlNow = millis();
    if (lastControlAttempt == 0 || controlNow - lastControlAttempt >= 3000) {
      lastControlAttempt = controlNow;
      if (!readControl()) { delay(100); return; }
      if (!capturePaused) nextCapture = millis();
    }
    if (!controlReady || (capturePaused && !previewRequested)) { delay(50); return; }
  }
  if (!cameraInitialized) {
    if (!previewRequested && static_cast<int32_t>(millis() - nextCapture) < 0) { delay(50); return; }
    const esp_err_t result = initCamera();
    if (result != ESP_OK) { Serial.println("No se pudo reactivar la camara. Reintentando..."); nextCapture = millis() + 3000; return; }
    cameraInitialized = true; videoCamera = false;
  }
  if (previewRequested) { beginVideo(); if (videoClient) videoClient->loop(); }
  if (!capturePaused && static_cast<int32_t>(millis() - nextCapture) >= 0) {
    const uint32_t cycleStarted = millis();
    bool sent = false;
    if (cameraVideoMode(false)) {
      camera_fb_t *frame = esp_camera_fb_get();
      if (frame) esp_camera_fb_return(frame);
      frame = esp_camera_fb_get();
      if (frame) {
        if (frame->width == 800 && frame->height == 600) sent = sendPhoto(frame);
        esp_camera_fb_return(frame);
      } else Serial.println("No se pudo obtener una captura.");
    }
    const uint32_t elapsed = millis() - cycleStarted;
    const uint32_t interval = DEMO_MODE ? DEMO_CYCLE_MS : CAPTURE_INTERVAL_MS;
    const uint32_t pause = capturePauseMs(sent, DEMO_MODE, interval, elapsed);
    nextCapture = millis() + pause;
    Serial.printf("Ciclo %lu ms | espera %lu ms | modo %s\n", static_cast<unsigned long>(elapsed),
      static_cast<unsigned long>(pause), DEMO_MODE ? "demo 5s" : "estable");
    if (videoClient && previewRequested) videoClient->loop();
  }
  if (controlReady && videoReady && previewRequested && static_cast<int32_t>(millis() - nextPreview) >= 0 &&
      videoSent - videoAcked < VIDEO_MAX_PENDING && (capturePaused || static_cast<int32_t>(nextCapture - millis()) > 150)) {
    const uint32_t started = millis();
    if (cameraVideoMode(true)) {
      camera_fb_t *frame = esp_camera_fb_get();
      if (frame) { sendPreview(frame); esp_camera_fb_return(frame); }
    } else videoFailed = true;
    const uint32_t elapsed = millis() - started;
    nextPreview = millis() + (elapsed >= VIDEO_FRAME_MS ? 0 : VIDEO_FRAME_MS - elapsed);
  }
  delay(2);
}
