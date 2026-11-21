/*
 * Aura Tasks — i calcoli dei suoni del focus (P-004, passo 4.4; vedi docs/suoni.md) fuori dal thread principale.
 * Un pezzo di pioggia costa 60–90 ms, il triplo su un telefono lento: calcolato qui, il tocco che fa partire un suono non
 * lo aspetta e l'aurora del focus non si ferma. Riceve da js/ui-sound.js { id, name, rate, seed } e risponde { id, channels }
 * (i due canali passano senza copia), oppure { id, error: true }. I calcoli sono quelli di js/sound.js (Aura.sound.piece).
 */
'use strict';

self.window = self; // js/sound.js si attacca a window.Aura, come nella pagina
importScripts('sound.js');

self.addEventListener('message', event => {
  const { id, name, rate, seed } = event.data || {};
  let channels = null;
  try {
    channels = self.Aura.sound.piece(name, rate, seed);
  } catch (err) {
    channels = null;
  }
  if (channels) self.postMessage({ id, channels }, channels.map(channel => channel.buffer));
  else self.postMessage({ id, error: true });
});
