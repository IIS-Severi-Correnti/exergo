# Changelog

Le modifiche significative di Exergo sono documentate in questo file.

## [Unreleased]

- Prossima priorita della roadmap: `newtonian_particle`.
- Restano da completare la protezione amministrativa di `main`, la pulizia dei branch remoti gia mergiati e la revisione della licenza del codice prima di una release stabile.

## [0.1.0-beta.1] - 2026-08-16

### Stabilizzazione

- Formalizzato il primo checkpoint di release beta del progetto.
- Rimossi i workflow one-shot `integrate-wave-qa.yml` e `update-wave-docs.yml`, ormai obsoleti dopo il merge del dominio onde.
- Mantenute come pipeline permanenti la validazione generale, la QA browser estesa e la pubblicazione GitHub Pages.
- Aggiunti criteri di release e checklist per le pull request.
- Reso esplicito lo stato della licenza: i materiali con metadato `Licenza: CC-BY-SA-4.0` restano dichiarati tali, mentre i file senza dichiarazione esplicita non vengono automaticamente ricondotti alla stessa licenza.

### Stato funzionale del checkpoint

- 58 esercizi di Fisica classificati nella Simulation Coverage Map.
- 37 esercizi di Fisica con simulazione implementata e coperta dalla CI.
- 8 engine riutilizzabili: `rotational_platform`, `ideal_gas_process`, `one_dimensional_collision`, `fluid_statics`, `dc_circuit`, `calorimetry`, `ray_optics`, `wave_1d`.
- GitHub Pages generata automaticamente da `main`.
- Validazione automatica di indice, archivio, test Python, test Node, sito statico, smoke test browser e compilazione LaTeX.

### Limiti noti della beta

- `main` non e ancora protetto da branch protection lato GitHub.
- Sono ancora presenti branch remoti gia mergiati che possono essere eliminati senza perdita di contenuto.
- La validazione didattica con utenti reali e ancora da formalizzare.
- La licenza del codice del repository deve essere scelta esplicitamente prima di una release stabile.
