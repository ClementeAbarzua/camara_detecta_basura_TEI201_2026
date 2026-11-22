// Aplicar antes de cargar los estilos evita un destello claro al abrir el tema oscuro.
(() => {
  const key = 'xiao-theme';
  const valid = value => value === 'light' || value === 'dark';
  let saved = null;
  try { saved = localStorage.getItem(key); } catch { /* La página funciona con almacenamiento bloqueado. */ }
  const system = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  let choice = valid(saved) ? saved : null;
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    for (const button of document.querySelectorAll('[data-theme-choice]'))
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  }
  const preferred = () => choice || (system?.matches ? 'dark' : 'light');
  apply(preferred());
  function bind() {
    for (const button of document.querySelectorAll('[data-theme-choice]')) button.addEventListener('click', () => {
      choice = button.dataset.themeChoice;
      if (!valid(choice)) return;
      try { localStorage.setItem(key, choice); } catch { /* Conservar la elección al menos en esta página. */ }
      apply(choice);
    });
    apply(preferred());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true}); else bind();
  system?.addEventListener?.('change', () => { if (!choice) apply(preferred()); });
  addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    choice = valid(event.newValue) ? event.newValue : null;
    apply(preferred());
  });
})();
