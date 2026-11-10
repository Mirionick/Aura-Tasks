# Punti e serie di giorni (realizzata, gratuita)

**Obiettivo**: motivare con piccole ricompense quotidiane. La logica pura sta in `js/points.js` e le regole in `POINTS`.

**Punti**
- Formula: `Math.round((10 + Math.min(durata, 120) / 5) × moltiplicatore)`, con moltiplicatore 1 per energia bassa, 1,5 per media e 2 per alta.
  - 15 min bassa → 13; 30 min media → 24; 60 min alta → 44; 120 min alta → 68.
- Al completamento i punti si salvano su `pointsAwarded`.
- "Annulla", o togliere la spunta, sottrae gli stessi punti dal giorno in cui erano stati dati: spuntare e togliere la spunta non fa accumulare.
- Eliminare un'attività completata o usare "Svuota" **non** toglie punti.

**Serie**
- È il numero di giorni consecutivi con almeno un completamento, contati all'indietro da oggi.
- Se oggi non c'è ancora nessun completamento si parte da ieri: la serie resta "viva", ma "da accendere", fino a mezzanotte.
- Il record (`bestStreak`) è la serie più lunga del registro.

**Traguardi**
- A 3, 7, 14, 30 e 100 giorni partono coriandoli, un avviso festoso e, su Android, una vibrazione.
- Succede una volta sola per traguardo (`stats.milestones`).

**Interfaccia**
- Serie e punti si vedono in due posti, con gli stessi effetti: in piccolo nell'intestazione di Focus (due chip: fiamma con i giorni, stella con i punti; un tocco porta a Motivazione) e in grande nell'intestazione di Motivazione, con i due riquadri qui sotto.
- Riquadro "Serie" (vedi "Design" in `CLAUDE.md`):
  - giorni e fiamma;
  - etichetta "🏆 record N", oppure "🏆 record!" quando la serie in corso è il record, da 3 giorni in su;
  - barra e scritta verso il prossimo traguardo, oppure "Accendila oggi" / "Tienila accesa oggi".
- Riquadro "Punti": totale, che sale contando, e "+N oggi".
- "Fatte oggi" legge il registro, non l'elenco delle attività.
- Avvisi al completamento:
  - "Completata · +24 punti";
  - al primo completamento del giorno: "🔥 Serie iniziata · …" oppure "🔥 4 giorni di fila · …";
  - ai traguardi: "🎉 7 giorni di fila! · …";
  - completando dal focus a tutto schermo, in coda: "· 25 min di focus". I minuti di focus non danno punti e non toccano la serie.

**Casi limite (coperti dai test)**
- Completamenti a cavallo di mezzanotte: fa fede il giorno locale di `completedAt`.
- Annullare un completamento di ieri: si sottrae da ieri.
- Cambio d'ora e capodanno: si usano `addDays` e `daysBetween`.
- Cambio di fuso orario: i giorni restano quelli registrati quando si è completato.

**Idee per dopo**: bonus punti per il focus. Livelli e statistiche settimanali sono nella scheda Motivazione (vedi [tre-modalita.md](tre-modalita.md)).
