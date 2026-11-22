/**
 * Planificación pura del siguiente envío. Error: espera al menos 30 s. Modo estable: pausa completa tras enviar. Demo: espera solo lo que falta para completar el ciclo objetivo.
 */
#pragma once
#include <stdint.h>

// El trabajo de captura, HTTPS, analisis y guardado ya consumio elapsedMs.
// En demo solo se espera lo que falta para un ciclo completo, sin solapar envios.
static inline uint32_t capturePauseMs(bool sent, bool demo, uint32_t intervalMs, uint32_t elapsedMs) {
  if (!sent) return intervalMs > 30000U ? intervalMs : 30000U;
  if (!demo) return intervalMs;
  return elapsedMs < intervalMs ? intervalMs - elapsedMs : 0U;
}
