# Illustrazioni

Le genera l'utente, gratis, con **Nano Banana nell'app Gemini**: niente API né server MCP. Servono alla scheda Motivazione (distintivi dei livelli) e agli stati vuoti delle tre schede (vedi [tre-modalita.md](tre-modalita.md)).

## Flusso
1. L'utente genera ogni immagine con il suo prompt e la salva, con il nome della tabella, in `Documenti\Aura-immagini`, **fuori dal repository**.
   - Gemini le salva come **JPEG 2048×2048**, anche se il nome finisce in `.png`: va bene così, per 336 e 540 px la qualità basta.
   - Conviene una **chat nuova per ogni immagine**: nella stessa chat Nano Banana riprende elementi dalle immagini precedenti (cornici, stelline).
2. Claude le guarda e le misura, e dice se qualcuna va rifatta (vedi "Revisione").
3. Claude le ottimizza con strumenti nella cartella temporanea:
   - **distintivi**: niente scontorno. Si ritaglia un **cerchio perfetto** che passa sul bordo esterno dell'anello d'oro, 1–2 px all'interno, con il contorno morbido.
     - L'anello resta intero, perché è lui a distinguere i livelli: puntini, anello interno, stelle, raggi.
     - Se la medaglia non è un cerchio pulito, va rifatta;
   - **scene**: si toglie tutto il quasi bianco (entro 12 livelli dal colore dello sfondo).
     - Va tolto sia quello attaccato ai bordi sia quello **chiuso nel disegno**, come il manico di una tazza o lo spazio tra le foglie: il soggetto non usa mai il bianco puro.
     - Poi si toglie 1 px di bordo del soggetto, cioè i pixel mescolati al bianco, così non resta un alone chiaro;
     - **Ripiego per una scena con un alone**, quando entra nell'app prima di essere rifatta: la frangia chiara legata al bianco (da 12 a 60 livelli dallo sfondo) non si taglia netta. Diventa semitrasparente in proporzione, e le si toglie il bianco che ha mescolato. Sul tema chiaro l'immagine resta com'era; su quello scuro l'alone sfuma, invece di fare un bordo chiaro e frastagliato;
   - ritaglio quadrato attorno al soggetto, con un margine del 6 % per lato, e riduzione in due passi;
   - **WebP**, poche decine di kB (`suggest-none`: 22 kB; `empty-focus`: 34 kB);
   - controllo di ognuna sul tema chiaro e su quello scuro.
4. Le WebP vanno in `app-attivita/images/` e in `APP_FILES` di `sw.js`. **Gli originali non entrano mai nel repository.**
5. **Ogni immagine entra con la fase che la usa, nella versione che c'è in quel momento.** Se quella rifatta non è ancora pronta, entra quella attuale. Si sostituisce più avanti: stesso nome del file, e `CACHE_VERSION` aumentata in `sw.js`.
6. Dove un'immagine non è ancora entrata, l'app usa le icone (distintivi) o uno stato vuoto di solo testo.

Nano Banana spesso non fa sfondi trasparenti veri. Per questo i prompt chiedono un **bianco puro uniforme** e un soggetto che non lo usa mai: le luci sono avorio. Così lo sfondo delle scene si toglie senza intaccare il soggetto.

**Niente aloni**: una luce che sfuma nel bianco non si può togliere bene.
- Con il taglio netto, sul tema scuro resta un anello chiaro attorno al soggetto.
- Con il ripiego della frangia semitrasparente l'alone sfuma, ma diventano un po' trasparenti anche le parti avorio che toccano lo sfondo, come un aeroplanino di carta o le stelline chiare.
- Per questo le scene con un alone vanno rifatte, anche quando intanto entrano nell'app.

## Revisione (10 novembre 2026)
Le 12 immagini sono state guardate e misurate: cerchio e anello d'oro lungo 720 raggi, sfondo, margini, frangia chiara attaccata allo sfondo, bianchi chiusi nel disegno.
- **In tutte**: niente testo, colori della palette, margini di almeno il 7 %, sfondo uniforme (almeno il 94 % dei pixel entro 2 livelli dal bianco). Il logo di Gemini non c'è.
- **Distintivi**: i 7 hanno lo stesso identico cerchio (centro e raggio uguali entro 0,3 px, scarto massimo dal cerchio 1,9 px su 2048), con l'anello d'oro intero.

| Immagine | Esito | Perché |
|---|---|---|
| `level-1-spark`, `level-2-flame` | ok | |
| `level-3-glow` | ok, da rifare solo se si vuole | è un pianeta con gli anelli: con il nome «Bagliore» stona un po' |
| `level-4-star` | **da rifare** | cornice identica alla 5: stessi 24 puntini e stesso anello interno |
| `level-5-comet`, `level-6-constellation`, `level-7-aurora` | ok | |
| `empty-focus` | **da rifare**; intanto **nell'app** dalla fase 2a, così com'è | alone attorno al vapore (frangia chiara di 25 px in media; nei distintivi 1,6) |
| `empty-agenda` | **da rifare** | alone attorno al sole e alla scia dell'aeroplanino (16 px) |
| `empty-motivation` | **da rifare** | alone arancio attorno alla scintilla (12,5 px) |
| `suggest-none` | ok, **nell'app** dalla fase 2a | bordi netti (1,7 px) |
| `streak-restart` | **da rifare** | l'arco sfuma nel bianco ed è interrotto in alto |

Tre scene (`empty-motivation`, `suggest-none`, `streak-restart`) hanno le stesse stelline negli stessi punti: non è un motivo per rifarle, perché non compaiono mai insieme.

`empty-focus` è entrata nella fase 2a per scelta dell'utente, senza aspettare la versione rifatta. È ottimizzata con il ripiego della frangia semitrasparente. Quando arriva quella nuova, prende il suo posto.

### Come rifarle: prompt di modifica
In una chat nuova di Gemini si allega l'immagine attuale e si incolla il prompt. Il risultato si salva con lo stesso nome.

1. `level-4-star`. Così la cornice cresce di livello in livello: 1–3 liscia, 4 puntini, 5 puntini più anello interno, 6 stelline, 7 stelline più raggi.
   > Edit this image. Remove only the thin gold ring that runs between the ring of dots and the star, filling that line with the same violet-to-indigo gradient as the face. Keep everything else exactly the same: the outer gold rim, the 24 dots, the star and its sparkles, the colors, the size and position of the medallion, and the flat pure white #FFFFFF background. No text.
2. `empty-focus`
   > Edit this image. Remove the soft glow and haze around the steam: the steam becomes smooth, fully opaque ribbons of cyan, aqua green and pink with crisp clean edges, and the pale wisp just above the tea becomes a solid lavender ribbon. Nothing spills onto the background. Keep everything else exactly the same: cup, cushion, gold star, dots, composition, colors, and the flat uniform pure white #FFFFFF background.
3. `empty-agenda`
   > Edit this image. Remove the soft glow around the sun and around the paper plane's trail: the sun becomes a crisp solid amber and gold shape, the trail a crisp solid ribbon of cyan, aqua green and pink. No glow, haze or blur around any element. Keep everything else exactly the same, including the flat uniform pure white #FFFFFF background.
4. `empty-motivation`
   > Edit this image. Remove the soft orange glow around the gold spark at the bottom: the spark keeps its shape and colors, with crisp clean edges and nothing spilling onto the background. Keep everything else exactly the same: sprout, stars, dots, composition, and the flat uniform pure white #FFFFFF background.
5. `streak-restart`
   > Edit this image. Replace the soft arc of light behind the flame with a crisp, solid arc made of three flat bands touching each other — pink outside, amber in the middle, lavender inside — fully opaque, with clean sharp edges, continuous from end to end, with no white gaps, no fading into the background and no glow. Keep everything else exactly the same: flame, stones, stars, dots, composition, and the flat uniform pure white #FFFFFF background.
6. Solo se si vuole, `level-3-glow`
   > Edit this image. Replace the ringed planet with a radiant ivory and gold orb surrounded by short soft rays of cyan and lavender light, like a warm glow, with no rings around it. Keep everything else exactly the same: the medallion, the gold rim, the gradient face, the size and position, and the flat pure white #FFFFFF background.

Se un'immagine va generata da capo, nei prompt delle **scene** (dall'8 al 12, qui sotto) conviene togliere dallo stile «gentle inner glow» e «like soft aurora light», che invitano gli aloni, e le parole «glowing» e «light» dal soggetto.

## Elenco

| Originale (PNG quadrato, almeno 1024×1024) | Nell'app | Mostrata a | Uso |
|---|---|---|---|
| `level-1-spark.png` | `images/level-1-spark.webp`, 336×336 | 112 px | distintivo Scintilla |
| `level-2-flame.png` | `images/level-2-flame.webp`, 336×336 | 112 px | distintivo Fiamma |
| `level-3-glow.png` | `images/level-3-glow.webp`, 336×336 | 112 px | distintivo Bagliore |
| `level-4-star.png` | `images/level-4-star.webp`, 336×336 | 112 px | distintivo Stella |
| `level-5-comet.png` | `images/level-5-comet.webp`, 336×336 | 112 px | distintivo Cometa |
| `level-6-constellation.png` | `images/level-6-constellation.webp`, 336×336 | 112 px | distintivo Costellazione |
| `level-7-aurora.png` | `images/level-7-aurora.webp`, 336×336 | 112 px | distintivo Aurora, anche per Aurora 2, 3… con il numero scritto dall'app |
| `empty-focus.png` | `images/empty-focus.webp`, 540×540 | 180 px | Focus senza attività |
| `empty-agenda.png` | `images/empty-agenda.webp`, 540×540 | 180 px | giorno libero in Agenda |
| `empty-motivation.png` | `images/empty-motivation.webp`, 540×540 | 180 px | Motivazione all'inizio |
| `suggest-none.png` | `images/suggest-none.webp`, 540×540 | 180 px | «Cosa faccio adesso?» senza proposte |
| `streak-restart.png` | `images/streak-restart.webp`, 540×540 | 180 px | invito a ripartire |

## Prompt
Ognuno è completo, cioè il soggetto più lo stesso stile, ricavato dai colori dell'app. Si incolla così com'è.

1. `level-1-spark.png`
   > A round achievement badge, level 1 of 7, the simplest of the set: a perfect circle medallion with a smooth violet-to-indigo gradient face and a thin gold rim. In the center, one small four-pointed gold spark with a warm ivory core and two tiny dots of light. Everything stays inside the circle. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

2. `level-2-flame.png`
   > A round achievement badge, level 2 of 7: a perfect circle medallion with a smooth violet-to-indigo gradient face and a thin gold rim. In the center, a small warm flame in amber and gold with a warm ivory core. Everything stays inside the circle. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

3. `level-3-glow.png`
   > A round achievement badge, level 3 of 7: a perfect circle medallion with a smooth violet-to-indigo gradient face and a thin gold rim. In the center, a glowing ivory orb wrapped in two soft concentric rings of cyan and lavender light. Everything stays inside the circle. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

4. `level-4-star.png`
   > A round achievement badge, level 4 of 7: a perfect circle medallion with a smooth violet-to-indigo gradient face and a gold rim decorated with small evenly spaced dots. In the center, a bright five-pointed gold star with three tiny sparkles around it. Everything stays inside the circle. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

5. `level-5-comet.png`
   > A round achievement badge, level 5 of 7: a perfect circle medallion with a smooth violet-to-indigo gradient face and a double thin gold rim. Across the face, a comet with a gold head and a long curved tail of cyan and pink light. Everything stays inside the circle. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

6. `level-6-constellation.png`
   > A round achievement badge, level 6 of 7: a perfect circle medallion with a deep night-violet face and a double gold rim with tiny stars set in it. In the center, a constellation of six gold stars joined by thin ivory lines. Everything stays inside the circle. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

7. `level-7-aurora.png`
   > A round achievement badge, level 7 of 7, the most precious of the set: a perfect circle medallion with a deep violet sky face and a thick ornate gold rim with small engraved rays. Inside, flowing ribbons of aurora light in cyan, pink and aqua green above a tiny horizon line, with a few gold stars. Everything stays inside the circle. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

8. `empty-focus.png`
   > Everything is done for today: a steaming cup of tea on a small round lavender cushion; the steam curls up into a soft swirl of cyan and pink aurora light with one tiny gold star. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

9. `empty-agenda.png`
   > A free day: an open planner notebook with blank lavender pages, a small sun above it and a paper plane gliding beside it. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

10. `empty-motivation.png`
    > The start of a journey: a small aqua green sprout growing out of a glowing gold spark, with three tiny stars above it. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

11. `suggest-none.png`
    > Time for a little break: a cozy rounded violet armchair with a soft cushion, a steaming mug on a small side table and a small potted plant. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.

12. `streak-restart.png`
    > Starting again: a tiny ember inside a small ring of round stones, with a fresh new amber and gold flame rising from it and a gentle arc of sunrise light behind it. Style: soft modern vector illustration, smooth gradients, gentle inner glow, calm and friendly, like soft aurora light. Rounded shapes, no harsh outlines, no texture or grain. No text, letters, numbers, logos or watermark. Use only these colors: deep violet #4B2FD0, indigo #4F46E5, violet #6A4CF5, lavender #C3B5FF, cyan #38D6FF, pink #FF70BE, aqua green #52D3A8, amber #F6C25F, gold #FFD23F, warm ivory #FFF5D6; highlights are warm ivory, never pure white. One centered subject filling about 70% of the image, with empty space on every side: it never touches the edges. Crisp clean silhouette with no outer glow, no drop shadow and no light spilling outside it. Background: perfectly flat, uniform pure white #FFFFFF, with no gradient, texture, vignette, floor or reflection. Square 1:1.
