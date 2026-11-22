// Formato compatible con Excel en configuraciones que usan coma decimal.
export function historyCSV(entries) {
  const decimal = value => Number.isFinite(value) ? value.toFixed(3).replace('.', ',') : '';
  const pct = value => decimal(value * 100);
  const headers = ['ID', 'Camara', 'Recepcion UTC', 'Conclusion', 'Basura actual (%)', 'Basura promedio (%)', 'Sin basura (%)', 'Botellas (%)', 'Papeles y Cartones (%)', 'Bolsas (%)', 'Umbral (%)', 'Capturas en promedio', 'Confirmaciones', 'Analisis (ms)'];
  const rows = entries.map(row => [row.id, row.cameraId, new Date(row.receivedAt).toISOString(), row.conclusion,
    pct(row.trashNow), pct(row.trashAverage), ...row.scores.map(pct), pct(row.threshold), row.readings, row.streak, row.analysisMs]);
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  return '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(';')).join('\r\n') + '\r\n';
}
