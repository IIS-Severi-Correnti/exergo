# Exergo Simulation Architecture v1

Le simulazioni sono arricchimenti progressivi delle pagine degli esercizi.
Testo e soluzione rimangono sempre disponibili anche senza JavaScript. Il sito
resta interamente statico e pubblicabile con GitHub Pages.

## Architettura

Il flusso e:

~~~text
Exercise (.tex)
    -> Simulation configuration (JSON)
    -> Reusable simulation engine (model + state)
    -> Interactive view (SVG + DOM)
~~~

Un **simulation engine** rappresenta un modello fisico riusabile. Riceve dati
in unita SI, calcola lo stato e non accede al DOM. Una **config** descrive invece
un particolare esercizio: parametri, modello adottato, interazioni consentite,
grandezze da visualizzare e copia didattica. Cambiare massa, raggio, numero o
nome dei partecipanti non richiede di modificare il motore.

La struttura v1 e:

~~~text
simulazioni/
|-- core/
|   |-- runtime.js          caricamento, ciclo requestAnimationFrame e lifecycle
|   |-- controls.js         collegamento dei pulsanti HTML alle azioni
|   |-- registry.js         registro esplicito dei motori caricabili
|   -- simulation.css       stile caricato solo nelle pagine con simulazioni
|-- engines/
|   -- rotational_platform/
|       |-- engine.js       modello fisico e stato, senza DOM
|       |-- view.js         vista SVG e aggiornamento accessibile
|       -- manifest.json    entry point, modelli e schema della config
|-- config/
|   -- <EXERCISE-ID>.json
-- README.md
~~~

Il generatore copia nel sito statico solo il core, i motori e le configurazioni
richiesti dagli esercizi presenti.

Rispetto alla struttura concettuale iniziale, lo stile condiviso vive in
core/simulation.css e la validazione lato build vive in
scripts/simulation_config.py. Il primo e un asset comune a tutte le view; il
secondo appartiene alla pipeline Python e non al runtime browser. La separazione
tra runtime, modello, rendering e configurazione resta invariata.

## Associare una simulazione a un esercizio

Nel blocco iniziale di metadati del file .tex aggiungere:

~~~tex
% Simulazione: rotational_platform
~~~

Il campo e facoltativo e contiene il nome del motore, non i valori numerici.
Creare poi simulazioni/config/EXERCISE-ID.json. Il nome del file deve
corrispondere esattamente all'ID dell'esercizio.

## Riutilizzare un motore esistente

Il riuso reale di `rotational_platform` e verificato da due esercizi pubblicati:

- `FIS-ROT-ANG-001`: sei ragazze su una piattaforma rotante;
- `FIS-ROT-ANG-002`: otto studenti su una giostra rotante.

I due casi usano masse, raggi, conteggi, velocita, target e testi diversi, ma
condividono lo stesso `engine.js`. Per aggiungere un ulteriore esercizio:

1. aggiungere `Simulazione: rotational_platform` al .tex;
2. copiare una configurazione v1 come punto di partenza;
3. rinominare il JSON con il nuovo ID;
4. modificare parametri, opzioni, display e dati didattici;
5. eseguire validazione e test.

Non copiare il JavaScript per creare una variante numerica. Se una nuova config
non basta, chiedersi prima se serve un nuovo **modello** nello stesso motore o
un fenomeno fisico realmente diverso che giustifichi un nuovo motore.

## Creare una configurazione

Ogni config contiene almeno:

- `schema_version`: versione del contratto dati, attualmente 1;
- `engine`: nome del motore, uguale al metadato del .tex;
- `model`: variante fisica esplicitamente adottata;
- `parameters`: dati fisici e criterio numerico dell'obiettivo;
- `interaction`: azioni abilitate;
- `display`: grandezze ed equazioni visibili;
- `didactics.model_note_it`: ipotesi e limiti del modello in forma leggibile.

Per `rotational_platform`, la sezione `didactics` puo inoltre personalizzare la
copia senza modificare la view:

- `participant_singular_it` e `participant_plural_it`;
- `participant_count_label_it`;
- `remove_action_label_it`;
- `learning_action_it`.

Questi campi restano opzionali nello schema v1 e hanno fallback generici
(`persona`, `persone`, ecc.), quindi l'estensione e retrocompatibile con le
configurazioni v1 precedenti.

Il manifest del motore elenca chiavi, tipi, vincoli, versioni e modelli
supportati. Chiavi sconosciute sono errori: un refuso come `participant_mass_k`
non viene ignorato.

### Unita

I dati interni usano esclusivamente unita SI e nomi espliciti:

- masse in chilogrammi: suffisso `_kg`;
- lunghezze in metri: suffisso `_m`;
- velocita angolari in radianti al secondo: suffisso `_rad_s`;
- tolleranze con la stessa unita della grandezza confrontata.

Non sono previste conversioni implicite. Il numero di partecipanti e un intero.

### Versione dello schema

`schema_version` non e decorativo. Runtime e validatore v1 accettano soltanto la
versione 1; una versione sconosciuta fallisce con un errore leggibile. Una
futura modifica incompatibile dovra aggiungere una nuova versione al manifest e
la relativa gestione, senza reinterpretare silenziosamente le config esistenti.
Estensioni opzionali e retrocompatibili, come la copia didattica configurabile,
possono invece restare nello schema v1.

## Creare un nuovo motore

1. creare `simulazioni/engines/engine_name/`;
2. aggiungere un `manifest.json` v1 con entry point, versioni, modelli, schema e
   vincoli incrociati;
3. esportare da `engine.js` una funzione `createSimulationEngine(config)`;
4. mantenere formule e stato testabili senza DOM;
5. esportare da `view.js` `createSimulationView({container, config})`;
6. registrare i loader lazy in `core/registry.js`;
7. aggiungere test del modello, dello stato, di una config non pilota e della
   generazione statica.

La view deve usare elementi HTML reali per i controlli, testo per lo stato,
SVG quando adatto e `prefers-reduced-motion`. Il runtime comune si occupa del
lifecycle; il motore non deve manipolare HTML.

## Modelli fisici e trasparenza

Ogni configurazione deve dichiarare il modello e una nota sulle sue ipotesi.
Il prototipo usa `textbook_reduced_system`: conserva un momento angolare di
riferimento per il sistema ridotto formato da piattaforma e persone rimaste.
Non descrive l'impulso e il momento angolare portato via durante un salto o
un'uscita reale.

Una futura variante, per esempio `full_angular_momentum`, va aggiunta come
implementazione distinta nel registro dei modelli del motore e nel manifest.
Non va nascosta dietro lo stesso nome ne introdotta riscrivendo la view.

## Regola contro l'hardcoding

Masse, raggi, conteggi, velocita, target e testi specifici di un esercizio
appartengono al JSON. In `engine.js` sono ammessi soltanto costanti matematiche o
coefficienti del modello fisico, come `1/2` per il momento d'inerzia di un disco
pieno. Numeri specifici dei casi pubblicati possono comparire solo nelle fixture
di test.

## Validare e testare

~~~bash
python scripts/genera_indice.py
python scripts/valida_archivio.py
python -m unittest discover -s tests -p "test_*.py"
node --test tests/js/*.test.mjs
python scripts/genera_sito.py --output _site
~~~

I test Python coprono config e generazione. I test Node usano soltanto il test
runner integrato e verificano modello, stato e contratto della vista senza npm o
dipendenze. Il piccolo `simulazioni/package.json` dichiara esclusivamente i
moduli ES e non introduce pacchetti da installare.

La CI esegue inoltre `tests/browser/simulation_smoke.html` con Chrome headless:
inizializza entrambe le configurazioni reali, esercita controlli, rimozioni,
obiettivi, slot stabili e reset, quindi salva screenshot desktop e mobile di
entrambi gli esercizi come artifact di revisione.
