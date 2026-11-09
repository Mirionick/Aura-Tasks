/*
 * Aura Tasks — tema chiaro / scuro / automatico.
 * Caricato nel <head> SENZA defer: imposta data-theme su <html> prima che la pagina venga disegnata,
 * così non c'è il "lampo" del tema sbagliato all'apertura.
 */
(function (Aura) {
  'use strict';

  const KEY = 'aura-tasks:theme';
  const MODES = ['auto', 'light', 'dark'];
  // Colore della barra di stato (Android, Safari): uguale a --hero-top in style.css. Se cambi l'uno, cambia l'altro.
  const BAR_COLORS = { light: '#4b2fd0', dark: '#15102e' };

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const listeners = [];
  let mode = readMode();

  function readMode() {
    try {
      const saved = window.localStorage.getItem(KEY);
      return MODES.includes(saved) ? saved : 'auto';
    } catch (err) {
      return 'auto';
    }
  }

  /** Tema effettivo ('light' | 'dark') della modalità scelta. */
  function resolve(value) {
    if (value === 'auto') return systemDark.matches ? 'dark' : 'light';
    return value;
  }

  function apply() {
    const theme = resolve(mode);
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', BAR_COLORS[theme]);
    listeners.forEach(fn => fn(mode, theme));
  }

  /**
   * Cambio di tema con l'app aperta: tutto cambia di colpo e insieme. Per un attimo la classe spegne le transizioni
   * di colore dei controlli, che altrimenti sfumerebbero dopo gli sfondi. Far sfumare i colori di tutta la pagina pesava
   * troppo (circa 100 fotogrammi persi su un telefono lento), e le View Transitions facevano cadere WebKit nelle prove
   * sul PC: vedi docs/tre-modalita.md.
   */
  function switchTheme() {
    const root = document.documentElement;
    root.classList.add('theme-instant');
    apply();
    void getComputedStyle(root).color; // i colori nuovi si calcolano adesso, senza transizioni
    root.classList.remove('theme-instant');
  }

  function setMode(value) {
    if (!MODES.includes(value) || value === mode) return;
    mode = value;
    try {
      window.localStorage.setItem(KEY, value);
    } catch (err) {
      // Non salvabile: la scelta vale comunque finché l'app resta aperta.
    }
    switchTheme();
  }

  // In modalità automatica segue il telefono anche mentre l'app è aperta.
  function onSystemChange() {
    if (mode !== 'auto') return;
    switchTheme();
  }
  if (systemDark.addEventListener) systemDark.addEventListener('change', onSystemChange);
  else if (systemDark.addListener) systemDark.addListener(onSystemChange); // Safari meno recenti

  // Tema cambiato in un'altra scheda.
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    mode = readMode();
    switchTheme();
  });

  apply();

  Aura.theme = {
    MODES,
    getMode: () => mode,
    getTheme: () => resolve(mode),
    setMode,
    onChange: fn => listeners.push(fn)
  };
})(window.Aura = window.Aura || {});
