#!/usr/bin/env python3
"""Regenera assets.h despues de comentar o modificar las fuentes de la web.

Solo requiere Python 3 y su biblioteca estandar. Conserva las bibliotecas y
el modelo ya incluidos en assets.h. Sustituye unicamente index.html y app.js
por los archivos de web_fuentes. Se ejecuta desde cualquier directorio.

Uso: python herramientas/generar_assets.py
"""

from pathlib import Path
import gzip
import re

ROOT = Path(__file__).resolve().parents[1]
HEADER = ROOT / 'assets.h'
FILES = [
    ('index.html', '/', 'text/html; charset=utf-8'),
    ('app.js', '/app.js', 'application/javascript; charset=utf-8'),
    ('tf.min.js', '/tf.min.js', 'application/javascript; charset=utf-8'),
    ('tm-image.min.js', '/tm-image.min.js', 'application/javascript; charset=utf-8'),
    ('model.json', '/model.json', 'application/json'),
    ('metadata.json', '/metadata.json', 'application/json'),
    ('weights.bin', '/weights.bin', 'application/octet-stream'),
]


def read_embedded_files():
    """Extrae los siete recursos gzip del encabezado existente."""
    text = HEADER.read_text(encoding='utf-8')
    pattern = r'static const uint8_t ASSET_(\d+)\[\] PROGMEM = \{(.*?)\};'
    resources = {}
    for match in re.finditer(pattern, text, re.S):
        index = int(match.group(1))
        packed = bytes(int(x, 16) for x in re.findall(r'0x([a-fA-F0-9]{2})', match.group(2)))
        resources[index] = gzip.decompress(packed)
    if set(resources) != set(range(len(FILES))):
        raise ValueError('assets.h debe contener los siete recursos del proyecto.')
    return resources


def generate():
    """Crea el encabezado completo y lo reemplaza solo despues de terminar."""
    resources = read_embedded_files()
    # Los recursos externos y el modelo se conservan exactamente.
    for index, name in [(0, 'index.html'), (1, 'app.js')]:
        resources[index] = (ROOT / 'web_fuentes' / name).read_bytes()

    parts = ['''/* ARCHIVO GENERADO AUTOMATICAMENTE
 * Ejecuta: python herramientas/generar_assets.py
 * Contiene pagina, JavaScript, bibliotecas y modelo comprimidos con gzip.
 * Los bytes se almacenan en flash y assetHandler() los sirve al navegador.
 * No editar manualmente las matrices hexadecimales.
 */
#pragma once
#include <Arduino.h>

// Descriptor de un recurso HTTP: ruta, datos, longitud, MIME, gzip y cache.
struct WebAsset {
  const char *uri;
  const uint8_t *data;
  size_t size;
  const char *contentType;
  bool gzip;
  const char *cacheControl;
};

''']
    total = 0
    for index, (name, uri, mime) in enumerate(FILES):
        packed = gzip.compress(resources[index], compresslevel=9, mtime=0)
        total += len(packed)
        parts.append('// ASSET_' + str(index) + ': ' + name + '\n')
        parts.append('static const uint8_t ASSET_' + str(index) + '[] PROGMEM = {\n')
        for start in range(0, len(packed), 20):
            parts.append(' ' + ','.join(f'0x{x:02x}' for x in packed[start:start + 20]) + ',\n')
        parts.append('};\n\n')

    parts.append('// Tabla que startServers() recorre para registrar las rutas.\n')
    parts.append('static const WebAsset WEB_ASSETS[] = {\n')
    for index, (name, uri, mime) in enumerate(FILES):
        symbol = 'ASSET_' + str(index)
        parts.append(' {"' + uri + '", ' + symbol + ', sizeof(' + symbol + '), "' + mime + '", true, "no-store"},\n')
    parts.append('};\nstatic constexpr size_t WEB_ASSET_COUNT = sizeof(WEB_ASSETS) / sizeof(WEB_ASSETS[0]);\n')

    temporary = HEADER.with_suffix('.h.tmp')
    temporary.write_text(''.join(parts), encoding='utf-8')
    temporary.replace(HEADER)
    print('assets.h actualizado. Recursos:', len(FILES), '| Bytes gzip:', total)


if __name__ == '__main__':
    generate()
