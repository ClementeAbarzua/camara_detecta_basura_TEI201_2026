// Avisos publicos sin imagenes, claves ni datos privados. Se publican solo tras guardar.
export function createLiveEvents() {
  const clients = new Set();
  function subscribe(req, res) {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (clients.size >= 100) { res.writeHead(503, { 'Retry-After':'2' }); res.end(); return; }
    res.writeHead(200, { 'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-cache, no-transform', 'X-Accel-Buffering':'no', 'Connection':'keep-alive' });
    res.flushHeaders(); clients.add(res);
    // Reconciliar al conectar o reconectar, aunque se hayan perdido avisos anteriores.
    res.write('retry: 2000\nevent: ready\ndata: {}\n\n');
    const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': keep-alive\n\n'); }, 25000);
    heartbeat.unref();
    res.once('close', () => { clearInterval(heartbeat); clients.delete(res); });
    res.on('error', () => res.destroy());
  }
  function publish() {
    for (const res of clients) {
      if (res.destroyed || res.writableLength > 65536) { res.destroy(); clients.delete(res); continue; }
      res.write('event: measurement\ndata: {}\n\n');
    }
  }
  function close() { for (const res of clients) res.end(); clients.clear(); }
  return { subscribe, publish, close };
}
export const liveEvents = createLiveEvents();
