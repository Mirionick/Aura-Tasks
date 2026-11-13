---
paths:
  - "app-attivita/js/motion.js"
  - "app-attivita/js/ui-focus.js"
  - "app-attivita/js/ui-assistant.js"
  - "app-attivita/css/style.css"
---

# Movimento e prestazioni

Le regole non sono scritte qui: stanno in `app-attivita/docs/CLAUDE-GUIDE.md`. Prima di cambiare un'animazione leggi:

- nella sezione «Convenzioni», le voci «Movimento» e «Telefono» (durate e curve, proprietà che si possono animare, FLIP e fantasmi, «Riduci movimento», animazioni continue);
- per la striscia della proposta (`js/ui-assistant.js`), la voce «Schede»;
- nella sezione «Test», la parte «Animazioni»: come si controllano le regole e come si misurano i fotogrammi persi.

In più, scritto solo qui:

- Ogni effetto nuovo mantiene il timer di riserva e non anima elementi che non si vedono.
- Prima di aumentare il numero di elementi animati misura i fotogrammi persi, prima e dopo.
