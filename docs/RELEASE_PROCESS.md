# Processo di release

Exergo usa release piccole e verificabili. La presenza di nuove funzionalita non e, da sola, sufficiente per dichiarare una release pronta.

## Livelli di maturita

- **beta**: architettura e contenuti sono utilizzabili, ma possono restare aspetti di governance, licenza o validazione didattica da consolidare;
- **stable**: oltre ai requisiti tecnici, sono chiusi i blocker di governance e licenza e il prodotto e stato provato in un contesto didattico reale.

La versione corrente e letta dal file `VERSION`.

## Gate obbligatori

Prima di mergiare una release o una modifica che cambia il comportamento del prodotto devono essere soddisfatti questi controlli:

1. `python scripts/genera_indice.py` non produce diff inattesi;
2. `python scripts/valida_archivio.py` passa;
3. la suite Python passa;
4. la suite Node dei motori di simulazione passa;
5. il sito statico viene generato correttamente;
6. gli smoke test browser passano in modalita normale, mobile e reduced-motion per le aree interessate;
7. i documenti LaTeX compilano;
8. la Simulation Coverage Map e la documentazione sono coerenti con il codice;
9. non vengono aggiunti workflow temporanei o auto-modificanti destinati a rimanere in `main`;
10. eventuali dati numerici illustrativi sono distinti dai dati reali degli esercizi.

## Pull request

Le modifiche non banali devono passare da un branch dedicato e da una pull request. La PR deve indicare:

- obiettivo e impatto didattico;
- file e domini interessati;
- eventuali assunzioni fisiche;
- distinzione tra dati del problema e scale illustrative;
- test eseguiti;
- eventuali limiti accettati.

La checklist standard e in `.github/pull_request_template.md`.

## Workflow permanenti

La directory `.github/workflows/` deve contenere solo automazioni con valore permanente. I workflow creati per patchare un singolo branch, sincronizzare una milestone o auto-modificare file una sola volta devono essere rimossi prima del merge in `main`.

Le pipeline permanenti correnti sono:

- `validate.yml`: validazione integrata dell'archivio e delle simulazioni;
- `validate-expansion-browser.yml`: QA browser estesa e artifact visuali;
- `pages.yml`: build e deploy di GitHub Pages.

## Release beta 0.1

Il checkpoint `0.1.0-beta.1` congela come baseline:

- 58 esercizi di Fisica classificati;
- 37 simulazioni implementate;
- 8 engine riutilizzabili;
- sito statico pubblico;
- CI integrata e QA browser.

Non e una dichiarazione di completezza della roadmap.

## Requisiti prima della prima release stabile

Prima di rimuovere il suffisso beta devono essere chiusi almeno questi punti:

- protezione di `main` con pull request e status check obbligatori;
- revisione della licenza del codice e della provenienza dei materiali;
- pulizia dei branch remoti mergiati;
- almeno un pilot didattico documentato con feedback di studenti o docenti;
- revisione di accessibilita oltre al solo controllo automatico del DOM.

## Regola di rollback

Una regressione su correttezza fisica, build, navigazione o accessibilita e un blocker. Se una release introduce una regressione non correggibile rapidamente, preferire il revert del commit o della PR responsabile rispetto a patch automatiche direttamente su `main`.
