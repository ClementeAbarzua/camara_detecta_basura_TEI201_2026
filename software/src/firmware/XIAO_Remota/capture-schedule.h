#pragma once
#include <stdint.h>

// El trabajo de captura, HTTPS, analisis y guardado ya consumio elapsedMs.
// En demo solo se espera lo que falta para un ciclo completo, sin solapar envios.
static inline uint32_t capturePauseMs(bool sent, bool demo, uint32_t intervalMs, uint32_t elapsedMs) {
  if (!sent) return intervalMs > 30000U ? intervalMs : 30000U;
  if (!demo) return intervalMs;
  return elapsedMs < intervalMs ? intervalMs - elapsedMs : 0U;
}
