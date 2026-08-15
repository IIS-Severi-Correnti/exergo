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
in unita SI, oppure rapporti adimensionali quando il testo non fornisce una
scala assoluta necessaria, calcola lo stato e non accede al DOM. Una **config**
descrive invece un particolare esercizio: parametri, modello adottato,
interazioni consentite, grandezze da visualizzare e copia didattica. Varianti
numeriche dello stesso modello non richiedono modifiche al motore.

La struttura v1 e:

~~~text
simulazioni/
|-- core/
|   |-- runtime.js          caricamento, ciclo requestAnimationFrame e lifecycle
|   |-- controls.js         collegamento dei pulsanti HTML alle azioni
|   |-- registry.js         registro esplicito dei motori caricabili
|   -- simulation.css       stile caricato solo nelle pagine con simulazioni
|-- engines/
|   |-- rotational_platform/
|   |   |-- engine.js       modello fisico e stato, senza DOM
|   |   |-- view.js         vista SVG e aggiornamento accessibile
|   |   |-- style.css       stile specifico del motore
|   |   -- manifest.json    entry point, modelli e schema della config
|   |-- ideal_gas_process/
|   |   |-- engine.js
|   |   |-- view.js
|   |   |-- style.css
|   |   -- manifest.json
|   -- one_dimensional_collision/
|       |-- engine.js
|       |-- view.js
|       |-- style.css
|       -- manifest.json
|-- config/
|   -- <EXERCISE-ID>.json
-- README.md
~~~

Il generatore copia nel sito statico solo il core, i motori e le configurazioni
richiesti dagli esercizi presenti.

Lo stile strutturale condiviso vive in core/simulation.css; colori, geometrie e
selettori di dominio vivono invece nello style.css del rispettivo motore. La
validazione lato build vive in scripts/simulation_config.py. Il primo e un asset
comune a tutte le view; il secondo appartiene alla pipeline Python e non al
runtime browser. La separazione tra runtime, modello, rendering e
configurazione resta invariata.

## Contratto multi-engine

Il core tratta nomi di azione, payload e descrittori dei controlli come dati
opachi. Non contiene condizioni sul nome del motore e non conosce partecipanti,
pistoni, palle o altre entita del dominio.

Ogni `engine.js` espone:

- `createSimulationEngine(config)`;
- `getState()`, `advance(deltaSeconds)` e `pause()` per il ciclo comune;
- `dispatch(action, payload)` per azioni lifecycle e azioni specifiche;
- facoltativamente metodi diretti utili ai test, senza cambiare il contratto del
  runtime.

Ogni `view.js` espone `createSimulationView({container, config})`. L'oggetto
restituito implementa `render(state)` e puo inoltre fornire:

- `describeControls(state, context)`, che decide stato, testo accessibile e
  visibilita dei controlli;
- `resolveActionPayload(context)`, che traduce un evento DOM in un payload;
- `handleActionResult(context)`, per effetti visivi conseguenti a un'azione;
- `motionAllowed` e `onMotionPreferenceChange(callback)` per
  `prefers-reduced-motion`.

`controls.js` rileva qualsiasi elemento con `data-simulation-action`, inoltra
l'azione senza interpretarla e applica soltanto descrittori DOM generici. Per
esempio, l'uscita di una persona e la sua animazione sono interamente nel motore
e nella view rotazionali; lo scrubbing del volume e interamente nel motore e
nella view del gas; il cambio tra sistema del tavolo e sistema del centro di
massa appartiene interamente al motore e alla view degli urti.

## Associare una simulazione a un esercizio

Nel blocco iniziale di metadati del file .tex aggiungere, per esempio:

~~~tex
% Simulazione: rotational_platform
~~~

Il campo e facoltativo e contiene il nome del motore, non i valori numerici.
Creare poi `simulazioni/config/EXERCISE-ID.json`. Il nome del file deve
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

`ideal_gas_process` supporta nella versione 1 il modello
`reversible_isothermal`: rappresenta una successione di stati di equilibrio a
temperatura costante, con `pV=nRT`, `Delta U=0` e `Q=L`. Il progresso del
playback e un parametro didattico, non tempo fisico; dinamica del pistone,
attriti, inerzia, scambi termici finiti e irreversibilita restano fuori dal
modello. Isobare, isocore, adiabatiche e cicli non sono implementati.

`one_dimensional_collision` introduce il modello `elastic_1d`: un urto
frontale, istantaneo ed elastico in una dimensione. Conserva quantita di moto ed
energia cinetica e permette di osservare lo stesso evento nel sistema del
tavolo e nel sistema del centro di massa. Se un esercizio specifica soltanto un
rapporto tra masse, la configurazione usa rapporti adimensionali invece di
inventare masse assolute. Le posizioni nella vista sono schematiche e il
progresso del playback ordina didatticamente prima, urto e dopo: non e un tempo
fisico. Urti anelastici, urti obliqui, deformazione durante il contatto e urti
successivi a tre o piu corpi non fanno parte del modello v1.

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

### Unita e rapporti

I dati dimensionali interni usano unita SI e nomi espliciti:

- masse assolute, quando necessarie, in chilogrammi: suffisso `_kg`;
- lunghezze in metri: suffisso `_m`;
- velocita lineari in metri al secondo: suffisso `_m_s`;
- velocita angolari in radianti al secondo: suffisso `_rad_s`;
- tolleranze con la stessa unita della grandezza confrontata.

Non sono previste conversioni implicite. Quando la fisica dipende soltanto dal
rapporto tra masse e il testo non fornisce una scala assoluta, un motore puo
usare parametri esplicitamente adimensionali con suffisso `_ratio`, come
`mass_1_ratio` e `mass_2_ratio` in `elastic_1d`.

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
6. aggiungere uno `style.css` del motore e dichiararlo negli entry point del
   manifest quando servono stili di dominio;
7. registrare i loader lazy in `core/registry.js`;
8. aggiungere test del modello, dello stato, di una config non pilota e della
   generazione statica.

La view deve usare elementi HTML reali per i controlli, testo per lo stato,
SVG quando adatto e `prefers-reduced-motion`. Il runtime comune si occupa del
lifecycle; il motore non deve manipolare HTML.

## Modelli fisici e trasparenza

Ogni configurazione deve dichiarare il modello e una nota sulle sue ipotesi.
Il prototipo rotazionale usa `textbook_reduced_system`: conserva un momento
angolare di riferimento per il sistema ridotto formato da piattaforma e persone
rimaste. Non descrive l'impulso e il momento angolare portato via durante un
salto o un'uscita reale.

Una futura variante, per esempio `full_angular_momentum`, va aggiunta come
implementazione distinta nel registro dei modelli del motore e nel manifest.
Non va nascosta dietro lo stesso nome ne introdotta riscrivendo la view. Lo
stesso criterio vale per un futuro `inelastic_1d`: non deve essere simulato
alterando silenziosamente le equazioni di `elastic_1d`.

## Regola contro l'hardcoding

Masse, raggi, conteggi, velocita, target e testi specifici di un esercizio
appartengono al JSON. In `engine.js` sono ammessi soltanto costanti matematiche o
coefficienti del modello fisico, come `1/2` per il momento d'inerzia di un disco
pieno o i coefficienti delle formule dell'urto elastico. Numeri specifici dei
casi pubblicati possono comparire solo nelle fixture di test.

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

La CI esegue inoltre smoke test con Chrome headless per i motori pubblicati,
verifica il comportamento con `prefers-reduced-motion`, controlla il layout
mobile e salva screenshot desktop/mobile come artifact di revisione. Per il
motore degli urti, lo smoke verifica anche cambio di sistema di riferimento,
invarianti del modello elastico, scrubbing prima/urto/dopo e reset.
