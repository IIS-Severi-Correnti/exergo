# Exergo Simulation Architecture v1

Le simulazioni sono arricchimenti progressivi delle pagine degli esercizi.
Testo e soluzione rimangono sempre disponibili anche senza JavaScript. Il sito
resta interamente statico e pubblicabile con GitHub Pages.

## Principio architetturale

Il flusso e:

~~~text
Exercise (.tex)
    -> Simulation configuration (JSON)
    -> Reusable simulation engine (model + state)
    -> Interactive view (SVG + DOM)
~~~

**Un motore rappresenta un modello o un dominio fisico riusabile, non un
esercizio.** I dati specifici del quesito appartengono alla configurazione JSON.
Quando il testo non fornisce una scala assoluta necessaria, la simulazione usa
rapporti adimensionali oppure una scala esplicitamente dichiarata didattica,
mai un dato fisico inventato presentato come parte del problema.

La struttura corrente e:

~~~text
simulazioni/
|-- core/
|   |-- runtime.js
|   |-- controls.js
|   |-- registry.js
|   -- simulation.css
|-- engines/
|   |-- rotational_platform/
|   |-- ideal_gas_process/
|   |-- one_dimensional_collision/
|   |-- fluid_statics/
|   |-- dc_circuit/
|   -- calorimetry/
|-- config/
|   -- <EXERCISE-ID>.json
-- README.md
~~~

Ogni motore contiene un manifest, il modello DOM-free, una view e gli eventuali
stili specifici. `fluid_statics` usa inoltre facade multi-model per mantenere
separate le view specialistiche senza spostare logica di dominio nel core.

Il generatore copia nel sito statico solo core, motori e configurazioni
necessari agli esercizi presenti. I test di subset verificano che, per esempio,
una build composta solo da circuiti non trascini calorimetria o fluidostatica.

## Contratto multi-engine

Il core tratta nomi di azione, payload e descrittori dei controlli come dati
opachi. Non contiene condizioni sul nome del motore e non conosce partecipanti,
pistoni, palle, recipienti, resistori o materiali.

Ogni `engine.js` espone almeno:

- `createSimulationEngine(config)`;
- `getState()`, `advance(deltaSeconds)`, `pause()`;
- `dispatch(action, payload)`;
- normalmente anche `play()`, `reset()` e `setProgress()` come API diretta
  testabile.

Ogni `view.js` espone `createSimulationView({container, config})`. L'oggetto
restituito implementa `render(state)` e puo inoltre fornire:

- `describeControls(state, context)`;
- `resolveActionPayload(context)`;
- `handleActionResult(context)` quando necessario;
- `motionAllowed` e `onMotionPreferenceChange(callback)` per
  `prefers-reduced-motion`.

`controls.js` inoltra le azioni senza interpretarle. Il runtime comune gestisce
lifecycle e `requestAnimationFrame`; formule, stato e significato fisico restano
negli engine.

## Engine attivi

### `rotational_platform`

Modello `textbook_reduced_system`, riusato da `FIS-ROT-ANG-001` e
`FIS-ROT-ANG-002`. Conserva il momento angolare del sistema ridotto
piattaforma-persone rimaste. Il modello dichiara il limite rispetto a un'uscita
reale che porterebbe via momento angolare.

### `ideal_gas_process`

Serve **tutti i sei esercizi sui gas perfetti** attraverso cinque modelli:

- `reversible_isothermal` — `FIS-TER-GAS-003` e `FIS-TER-GAS-006`, con
  `pV=nRT`, `Delta U=0` e `Q=L=nRT ln(V/Vi)`;
- `process_comparison` — `FIS-TER-GAS-001`, per confrontare isocora, isobara e
  isoterma a partire dallo stesso stato;
- `piecewise_isobaric_isothermal` — `FIS-TER-GAS-002`, percorso A→B isobaro e
  B→C isoterma;
- `thermodynamic_cycle` — `FIS-TER-GAS-004`, ciclo chiuso normalizzato per
  rendere visibili `Delta U_ciclo=0` e `Q_netto=L_netto`;
- `isochoric_monoatomic` — `FIS-TER-GAS-005`, bombola rigida con
  `L=0` e `Delta U=(3/2)V Delta p`.

Il motore distingue deliberatamente grandezze assolute, rapporti e variazioni.
In `FIS-TER-GAS-002` la pressione assoluta non e fornita, quindi la vista usa
`p/p_A`; in `FIS-TER-GAS-005` sono noti soltanto volume e aumento di pressione,
quindi mostra `Delta p` senza inventare `p_i`, `T_i` o `n`. Il quesito teorico
`FIS-TER-GAS-001` usa invece una scala numerica esplicitamente dichiarata
**didattica** per confrontare le forme delle tre trasformazioni.

Tutti i modelli rappresentano stati di equilibrio o percorsi didattici: il
playback non e tempo fisico. Dinamica del pistone, attriti, inerzia,
irreversibilita e velocita finite di scambio termico restano fuori dal dominio
corrente.

### `one_dimensional_collision`

Modello `elastic_1d` per urti frontali, istantanei ed elastici. Supporta sistema
del tavolo e sistema del centro di massa e usa rapporti di massa quando il testo
non fornisce masse assolute. Le posizioni sono schematiche e il progresso ordina
prima/urto/dopo, non rappresenta tempo fisico.

### `fluid_statics`

Primo engine Exergo esplicitamente multi-model. Serve otto esercizi attraverso
sei modelli:

- `hydrostatic_column`;
- `floating_body`;
- `buoyancy_apparent_weight`;
- `hydrostatic_pressure_points`;
- `hydraulic_press`;
- `communicating_vessels`.

Il dominio dimostra sia riuso tra configurazioni dello stesso modello sia riuso
di infrastruttura tra fenomeni distinti. Le grandezze non fornite vengono
omesse o dichiarate come scala didattica; per esempio `communicating_vessels`
usa soltanto il numero reale di rami e scarti di livello normalizzati, senza
inventare sezioni, volumi o quote metriche.

### `dc_circuit`

Serve tutti i cinque esercizi di circuiti elettrici attualmente presenti e usa
tre modelli:

- `single_loop_topology`: circuito aperto/chiuso senza parametri elettrici
  numerici inventati;
- `charge_flow`: definizione `I = Delta Q / Delta t`;
- `ohmic_resistor`: `V = RI`, corrente e potenza nel punto di lavoro.

`FIS-CIR-OHM-002` usa direttamente i dati `4 V`, `8 ohm -> 4 ohm` e mostra
`0,5 A -> 1 A`. I quesiti puramente teorici possono usare scale numeriche di
esplorazione, ma la config e la pagina le dichiarano esplicitamente come
**scale didattiche**, non dati del quesito.

La view V-I non e decorativa: la retta viene ricalcolata dalla resistenza dello
stato corrente e il punto rappresenta il punto di lavoro effettivo.

### `calorimetry`

Serve cinque esercizi attraverso cinque modelli:

- `sensible_heat_compare`: confronto `Q=mc Delta T` tra materiali;
- `heating_power`: `Q=eta P t` seguito da `Delta T=Q/(mc)`;
- `thermal_mixing`: equilibrio energetico tra due masse;
- `ice_water_balance`: riscaldamento del ghiaccio, fusione e successivo
  equilibrio;
- `phase_change_balance`: calore latente ceduto da una sostanza che solidifica
  e assorbito da una sostanza che si riscalda/vaporizza.

I modelli a fasi verificano il regime fisico prima di procedere. Per esempio
`ice_water_balance` rifiuta una configurazione in cui l'energia disponibile non
sia sufficiente a fondere completamente il ghiaccio, invece di applicare
silenziosamente la formula di un altro regime.

La coordinata interattiva rappresenta tempo soltanto quando il modello lo
consente esplicitamente (`heating_power` a potenza costante); negli altri casi e
una frazione di energia trasferita o una coordinata didattica.

## Associare una simulazione a un esercizio

Nel blocco iniziale del `.tex` aggiungere:

~~~tex
% Simulazione: dc_circuit
~~~

Il campo contiene il nome del motore, non i valori numerici. Creare quindi
`simulazioni/config/EXERCISE-ID.json`, con nome identico all'ID dell'esercizio.

Ogni config contiene almeno:

- `schema_version`;
- `engine`;
- `model`;
- `parameters`;
- `interaction`;
- `display`;
- `didactics`, inclusa una nota leggibile sulle ipotesi e sui limiti.

Il manifest del motore elenca chiavi, tipi, vincoli, versioni e modelli
supportati. Chiavi sconosciute sono errori. Gli engine multi-model usano varianti
`oneOf` strette per impedire che parametri di un modello vengano accettati da un
altro.

## Unita, rapporti e scale illustrative

I dati dimensionali interni usano unita SI e nomi espliciti (`_kg`, `_m`,
`_m_s`, `_Pa`, `_J`, `_W`, `_V`, `_A`, `_ohm`, ecc.). Non sono previste
conversioni implicite.

Quando la fisica dipende soltanto da un rapporto e il testo non fornisce una
scala assoluta, sono ammessi parametri adimensionali espliciti come
`mass_1_ratio`. Quando un quesito teorico beneficia di numeri per visualizzare
una proporzionalita, la scala puo comparire nel JSON solo se la copia didattica
la dichiara chiaramente come illustrativa.

## Creare o estendere un motore

1. verificare prima se basta una nuova config;
2. se cambia il modello ma resta lo stesso dominio, preferire un nuovo modello
   nello stesso engine;
3. creare un nuovo engine solo per un dominio/modello realmente distinto;
4. mantenere il calcolo testabile senza DOM;
5. aggiungere o aggiornare `manifest.json` con uno schema stretto;
6. registrare il loader lazy in `core/registry.js`;
7. aggiungere almeno un test con dati indipendenti dal pilot per escludere
   hardcoding;
8. aggiungere test config, asset graph e generazione statica;
9. verificare browser normale, reduced-motion e mobile;
10. revisionare screenshot prima del merge.

## Regola contro l'hardcoding

Masse, raggi, conteggi, velocita, target e testi specifici di un esercizio
appartengono al JSON. In `engine.js` sono ammessi soltanto costanti matematiche,
coefficienti fisici del modello e logica generale. Numeri specifici dei casi
pubblicati possono comparire nelle fixture di test, non nella logica del motore.

## Validare e testare

~~~bash
python scripts/genera_indice.py
python scripts/valida_archivio.py
python -m unittest discover -s tests -p "test_*.py"
node --test tests/js/*.test.mjs
python scripts/genera_sito.py --output _site
~~~

La CI aggiunge smoke test Chrome, `prefers-reduced-motion`, viewport mobile e
screenshot di revisione. `validate-expansion-browser.yml` mantiene una matrice
visuale dedicata ai domini aggiunti o estesi di recente, inclusi circuiti,
calorimetria e i cinque modelli del motore gas.

## Stato del catalogo simulato

Con il completamento del dominio gas, Exergo pubblica **27 esercizi di Fisica
con simulazione** attraverso **6 engine**. La fonte machine-readable per la
copertura resta `metadata/simulation_coverage.csv`; la roadmap e mantenuta in
`docs/SIMULATION_ROADMAP.md`.
