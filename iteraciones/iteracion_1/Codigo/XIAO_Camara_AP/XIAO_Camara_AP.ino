/* XIAO ESP32-S3 Sense (OV3660), Arduino-ESP32 3.x.
   Placa: XIAO_ESP32S3. PSRAM: OPI. USB CDC On Boot: Enabled.
   Wi-Fi: XIAO-CAM / Camara1234. Web: http://192.168.4.1
   Un visor de video a la vez. Fotos y video: JPEG 800x600.
   No requiere SD, Internet ni otros archivos del sketch.
*/
#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

const char *AP_SSID = "XIAO-CAM";
const char *AP_PASSWORD = "Camara1234";
static httpd_handle_t webServer = nullptr;
static httpd_handle_t videoServer = nullptr;
static SemaphoreHandle_t cameraMutex;
static bool cameraReady = false;

static const char PAGE[] PROGMEM = R"HTML(<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>XIAO Cámara</title><style>
*{box-sizing:border-box}body{margin:0;background:#101720;color:#edf5ff;font:16px system-ui,sans-serif}
main{max-width:860px;margin:auto;padding:22px}h1{margin:0 0 8px}p{color:#b8c8da;line-height:1.5}
.panel{background:#1b2735;border-radius:18px;padding:16px;margin:18px 0}
img{display:block;width:100%;height:auto;min-height:80px;border-radius:12px;background:#090e15}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
button,a.button{font:inherit;font-weight:650;padding:14px 20px;border:0;border-radius:12px;background:#72e6c0;color:#082b22;text-decoration:none;cursor:pointer}
button.secondary{background:#34485f;color:white}button:disabled{opacity:.5;cursor:wait}
[hidden]{display:none!important}#status{min-height:26px}small{color:#b8c8da}
</style></head><body><main><h1>📷 XIAO Cámara</h1>
<p>Video en vivo y fotos, conectados directamente a tu cámara.</p>
<div class="panel"><img id="live" alt="Video en vivo">
<div class="actions"><button id="snap">Sacar foto</button><button class="secondary" id="toggle">Pausar video</button></div>
<p id="status" role="status" aria-live="polite">Conectando video…</p>
<small>800 × 600 px · La foto se toma al presionar el botón.</small></div>
<section id="result" class="panel" hidden><h2>Tu foto</h2><img id="photo" alt="Última foto capturada">
<div class="actions"><a id="download" class="button">Descargar foto</a></div>
<small>Descárgala antes de sacar otra foto o cerrar esta página. En el celular también puedes mantener presionada la imagen para guardarla.</small></section>
</main><script>
const live=document.getElementById('live'),snap=document.getElementById('snap');
const toggle=document.getElementById('toggle'),status=document.getElementById('status');
let playing=false,photoURL=null;
function play(){playing=true;live.src='http://'+location.hostname+':81/stream?t='+Date.now();toggle.textContent='Pausar video';status.textContent='Video activo. Puedes sacar una foto.';}
function pause(){playing=false;live.removeAttribute('src');toggle.textContent='Iniciar video';status.textContent='Video pausado. Puedes seguir sacando fotos.';}
toggle.onclick=()=>playing?pause():play();
live.onerror=()=>{if(playing){playing=false;toggle.textContent='Reintentar video';status.textContent='No se pudo abrir el video. Cierra otras pestañas de la cámara y pulsa Reintentar video.';}};
snap.onclick=async()=>{
 snap.disabled=true;status.textContent='Tomando foto…';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch('/capture?t='+Date.now(),{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw new Error('Error '+response.status);
  const blob=await response.blob();
  if(photoURL)URL.revokeObjectURL(photoURL);
  photoURL=URL.createObjectURL(blob);document.getElementById('photo').src=photoURL;
  const link=document.getElementById('download');link.href=photoURL;
  link.download='XIAO_'+new Date().toISOString().replace(/[:.]/g,'-')+'.jpg';
  document.getElementById('result').hidden=false;
  status.textContent='Foto lista. Pulsa Descargar foto para guardarla.';
 }catch(error){status.textContent='No se pudo tomar la foto. Revisa la conexión a XIAO-CAM e inténtalo otra vez.';}
 finally{clearTimeout(timer);snap.disabled=false;}
};
play();
</script></body></html>)HTML";

static esp_err_t indexHandler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  if (!cameraReady) {
    return httpd_resp_send(req, "<h1>La red funciona, pero la camara no inicio.</h1><p>Revisa PSRAM: OPI y el monitor serie a 115200.</p>", HTTPD_RESP_USE_STRLEN);
  }
  return httpd_resp_send(req, PAGE, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t captureHandler(httpd_req_t *req) {
  if (!cameraReady || xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(6000)) != pdTRUE) {
    httpd_resp_set_status(req, "503 Service Unavailable");
    return httpd_resp_send(req, "Camara no disponible", HTTPD_RESP_USE_STRLEN);
  }
  // Descartar un cuadro para obtener una imagen mas reciente.
  camera_fb_t *fb = esp_camera_fb_get();
  if (fb) esp_camera_fb_return(fb);
  fb = esp_camera_fb_get();
  if (!fb) {
    xSemaphoreGive(cameraMutex);
    return httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "No se pudo capturar");
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  esp_err_t result = httpd_resp_send(req, (const char *)fb->buf, fb->len);
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
    int n = snprintf(header, sizeof(header), "\r\n--xiaoframe\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", (unsigned)fb->len);
    esp_err_t result = httpd_resp_send_chunk(req, header, n);
    if (result == ESP_OK) result = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    xSemaphoreGive(cameraMutex);
    if (result != ESP_OK) return result;
    // Dar tiempo a las capturas y reducir carga; no garantiza FPS fijos.
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

static esp_err_t initCamera() {
  if (!psramFound()) {
    Serial.println("ERROR: activa OPI PSRAM en Herramientas.");
    return ESP_FAIL;
  }
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer = LEDC_TIMER_0;
  c.pin_d0 = 15; c.pin_d1 = 17; c.pin_d2 = 18; c.pin_d3 = 16;
  c.pin_d4 = 14; c.pin_d5 = 12; c.pin_d6 = 11; c.pin_d7 = 48;
  c.pin_xclk = 10; c.pin_pclk = 13; c.pin_vsync = 38; c.pin_href = 47;
  c.pin_sccb_sda = 40; c.pin_sccb_scl = 39;
  c.pin_pwdn = -1; c.pin_reset = -1;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size = FRAMESIZE_SVGA;
  c.jpeg_quality = 12;
  c.fb_count = 2;
  c.fb_location = CAMERA_FB_IN_PSRAM;
  c.grab_mode = CAMERA_GRAB_LATEST;
  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) return err;
  sensor_t *s = esp_camera_sensor_get();
  if (s && s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }
  return ESP_OK;
}

static void startServers() {
  httpd_config_t cfg = HTTPD_DEFAULT_CONFIG();
  cfg.server_port = 80;
  cfg.stack_size = 8192;
  cfg.send_wait_timeout = 3;
  cfg.recv_wait_timeout = 3;
  cfg.lru_purge_enable = true;
  ESP_ERROR_CHECK(httpd_start(&webServer, &cfg));
  httpd_uri_t home = {}; home.uri = "/"; home.method = HTTP_GET; home.handler = indexHandler;
  httpd_uri_t capture = {}; capture.uri = "/capture"; capture.method = HTTP_GET; capture.handler = captureHandler;
  ESP_ERROR_CHECK(httpd_register_uri_handler(webServer, &home));
  ESP_ERROR_CHECK(httpd_register_uri_handler(webServer, &capture));
  // Otro servidor mantiene el video sin bloquear la pagina ni el boton de foto.
  cfg.server_port = 81;
  cfg.ctrl_port += 1;
  ESP_ERROR_CHECK(httpd_start(&videoServer, &cfg));
  httpd_uri_t stream = {}; stream.uri = "/stream"; stream.method = HTTP_GET; stream.handler = streamHandler;
  ESP_ERROR_CHECK(httpd_register_uri_handler(videoServer, &stream));
}

void setup() {
  Serial.begin(115200);
  delay(800); // Arranca aunque el monitor serie este cerrado.
  cameraMutex = xSemaphoreCreateMutex();
  if (!cameraMutex) { Serial.println("Sin memoria para mutex"); return; }
  esp_err_t err = initCamera();
  cameraReady = (err == ESP_OK);
  Serial.printf("Inicio camara: 0x%x\n", (unsigned)err);
  WiFi.mode(WIFI_AP);
  IPAddress ip(192,168,4,1), mask(255,255,255,0);
  if (!WiFi.softAPConfig(ip, ip, mask) || !WiFi.softAP(AP_SSID, AP_PASSWORD, 6, 0, 2)) {
    Serial.println("ERROR al crear la red Wi-Fi"); return;
  }
  startServers();
  Serial.printf("Red: %s\nClave: %s\nAbre http://192.168.4.1\n", AP_SSID, AP_PASSWORD);
}

void loop() { delay(1000); }
