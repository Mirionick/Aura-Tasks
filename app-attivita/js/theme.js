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
  let switchTimer = null;

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

  /** Mentre il tema cambia, i colori sfumano; la classe viene tolta subito dopo per non rallentare il resto. */
  function animateSwitch() {
    const root = document.documentElement;
    root.classList.add('theme-switching');
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => root.classList.remove('theme-switching'), 450);
  }

  function setMode(value) {
    if (!MODES.includes(value) || value === mode) return;
    mode = value;
    try {
      window.localStorage.setItem(KEY, value);
    } catch (err) {
      // Non salvabile: la scelta vale comunque finché l'app resta aperta.
    }
    animateSwitch();
    apply();
  }

  // In modalità automatica segue il telefono anche mentre l'app è aperta.
  function onSystemChange() {
    if (mode !== 'auto') return;
    animateSwitch();
    apply();
  }
  if (systemDark.addEventListener) systemDark.addEventListener('change', onSystemChange);
  else if (systemDark.addListener) systemDark.addListener(onSystemChange); // Safari meno recenti

  // Tema cambiato in un'altra scheda.
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    mode = readMode();
    apply();
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
