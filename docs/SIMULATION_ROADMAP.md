# Simulation Coverage Map e roadmap

Questa roadmap trasforma le simulazioni da funzionalità sperimentale a livello
strutturale di Exergo.

## Principio

L'obiettivo non è associare un'animazione a ogni esercizio. L'obiettivo è:

1. classificare il 100% degli esercizi di Fisica rispetto alla simulabilità;
2. costruire motori riutilizzabili per modelli fisici significativi;
3. evitare codice specifico per singolo esercizio;
4. dichiarare quando una simulazione non aggiunge abbastanza valore didattico;
5. rendere copertura, formule, build e comportamento browser verificabili dalla CI.

La fonte machine-readable è [`metadata/simulation_coverage.csv`](../metadata/simulation_coverage.csv).

## Fotografia corrente

L'indice contiene **58 esercizi di Fisica**.

| Stato | Numero | Significato |
|---|---:|---|
| `implemented` | 37 | Simulazione collegata all'esercizio e coperta dalla CI |
| `planned` | 16 | Copribile direttamente da un engine/modello pianificato |
| `extension` | 1 | Copribile estendendo un engine già esistente |
| `composite` | 2 | Richiede più fasi/modelli coordinati |
| `not_required` | 2 | Simulazione completa non giustificata didatticamente |

**56 esercizi su 58** hanno una traiettoria verso un modello interattivo; i due
`not_required` restano intenzionalmente fuori dalla copertura con engine.

Gli engine attivi sono:

- `rotational_platform` — 2 esercizi, modello `textbook_reduced_system`;
- `ideal_gas_process` — 6 esercizi, 5 modelli;
- `one_dimensional_collision` — 1 esercizio, modello `elastic_1d`;
- `fluid_statics` — 8 esercizi, 6 modelli;
- `dc_circuit` — 5 esercizi, 3 modelli;
- `calorimetry` — 5 esercizi, 5 modelli;
- `ray_optics` — 5 esercizi, 5 modelli.
- `wave_1d` — 5 esercizi, 5 modelli.

Il completamento del dominio `ideal_gas_process` porta il catalogo simulato da
23 a **27 esercizi** senza aggiungere un nuovo engine: quattro casi prima
classificati come `extension` diventano quattro modelli reali dello stesso
dominio termodinamico.

## Regola di priorità

Per ordinare il backlog usiamo la metrica euristica:

```text
priority_score = incremental_exercises * didactic_value / implementation_complexity
```

dove `didactic_value` e `implementation_complexity` sono valutati su scala 1–5.
Il punteggio ordina l'investimento, ma non sostituisce revisione fisica,
architetturale o didattica.

## Backlog dopo il completamento delle onde

| # | Engine | Tipo | Esercizi incrementali | Valore didattico | Complessità | Score | Ambito |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `newtonian_particle` | nuovo engine | 4 | 5 | 4 | 5.00 | Forze costanti 2D e piano inclinato con attrito |
| 2 | `electrostatics_2d` | nuovo engine | 3 | 5 | 4 | 3.75 | Campo puntiforme, Coulomb e confronto inverse-square |
| 3 | `magnetic_interaction_2d` | nuovo engine | 3 | 4 | 4 | 3.00 | Oersted, fili paralleli e forza di Lorentz |
| 4 | `electromagnetic_induction` | nuovo engine | 2 | 5 | 4 | 2.50 | Faraday-Lenz e variazione di flusso |
| 5 | `one_dimensional_collision` | estensione engine esistente | 1 | 5 | 2 | 2.50 | Urti elastici successivi tra più corpi |
| 6 | `piecewise_mechanics` | orchestrazione composita | 2 | 5 | 5 | 2.00 | Problemi a fasi: dinamica/urto/molla |
| 7 | `fluid_statics` | estensione engine attivo | 1 | 5 | 3 | 1.67 | Getti da fori a diversa profondità |
| 8 | `thermal_expansion` | nuovo engine | 1 | 3 | 2 | 1.50 | Dilatazione termica dei solidi |
| 9 | `momentum_system` | nuovo engine | 1 | 4 | 3 | 1.33 | Rinculo e sequenze di lanci |
| 10 | `heat_engine` | nuovo engine | 1 | 4 | 3 | 1.33 | Rendimento e macchina di Carnot |

## `ideal_gas_process`: copertura corrente

L'engine serve l'intero gruppo di sei esercizi sui gas perfetti con cinque
modelli.

### `reversible_isothermal`

Copre `FIS-TER-GAS-003` e `FIS-TER-GAS-006`:

```text
pV = nRT
Delta U = 0
Q = L = nRT ln(V/Vi)
```

I due esercizi restano la regressione storica del motore e dimostrano riuso
numerico dello stesso modello.

### `process_comparison`

Copre `FIS-TER-GAS-001`. Il quesito è teorico e non fornisce uno stato
numerico: la configurazione usa una scala esplicitamente didattica per partire
dallo stesso stato A e confrontare isocora, isobara e isoterma. Per isocora e
isobara non vengono inventati calori specifici, quindi `Q` e `Delta U` restano
simbolici; per l'isoterma di gas perfetto vale invece `Delta U=0` e `Q=L`.

### `piecewise_isobaric_isothermal`

Copre `FIS-TER-GAS-002` e coordina due fasi nello stesso spazio di stato:

```text
A -> B: p = costante
V_B = 1.30 L
T_B = 187.2 K

B -> C: T = costante
p_C / p_B = 0.5
V_C = 2.60 L
```

Il testo non fornisce pressione assoluta né numero di moli, quindi il diagramma
usa `p/p_A`: la normalizzazione conserva tutta l'informazione necessaria senza
inventare pascal.

### `thermodynamic_cycle`

Copre `FIS-TER-GAS-004`. Un rettangolo normalizzato e dichiaratamente
rappresentativo rende visibili chiusura del ciclo e area orientata. Le coordinate
non sono dati dell'esercizio. Sul ciclo completo:

```text
Delta U_ciclo = 0
Q_netto = L_netto
```

Il verso del percorso determina il segno del lavoro netto normalizzato.

### `isochoric_monoatomic`

Copre `FIS-TER-GAS-005` usando esclusivamente i dati realmente disponibili:

```text
V = 0.0600 m^3
Delta p = 2800 Pa
L = 0
Delta U = (3/2) V Delta p = 252 J
Q = 252 J
```

`p_i`, `T_i` e `n` non sono noti e non vengono creati dalla simulazione. La
vista mostra quindi `Delta p`, non una pressione assoluta fittizia.

## `ray_optics`: copertura corrente

L'engine serve tutti i cinque esercizi di ottica geometrica con cinque modelli indipendenti ma una sola infrastruttura SVG.

- `single_interface_refraction` — `FIS-OTT-RIF-001`: da una velocità ridotta del 33% ricava `v=0,67c` e `n≈1,493`, senza introdurre un angolo di incidenza assente dal testo.
- `snell_refraction` — `FIS-OTT-RIF-002`: dagli angoli reali `63°` e `47°` ricava `n2≈1,218` e `v≈2,46×10^8 m/s`; lo sweep dell'angolo mantiene fissi i due mezzi.
- `parallel_slab` — `FIS-OTT-RIF-003`: usa `i=30°`, `n=1,52` e `s=6,00 mm`, ottenendo `r≈19,2°` e spostamento laterale `d≈1,19 mm`; il raggio emergente resta parallelo all'incidente.
- `total_internal_reflection` — `FIS-OTT-RFL-001`: con acqua `n1=1,333` e `i=75°` ricava il limite `n2,max≈1,288`. Al valore massimo il rifratto è radente; per valori inferiori si ha riflessione totale.
- `concave_mirror` — `FIS-OTT-SPE-001`: nel regime paraassiale, `f=12 cm` e `M=+3` danno `p=8 cm` e `q=-24 cm`; il playback rivela i raggi principali e le estensioni che individuano l'immagine virtuale diritta.

Nessuno dei cinque modelli usa dati numerici inventati per ottenere il risultato dell'esercizio. Dove il cursore rappresenta una costruzione, la nota didattica lo dichiara esplicitamente come ordine di visualizzazione e non come tempo di propagazione.

## `wave_1d`: copertura corrente

L'engine serve tutti i cinque esercizi sulle onde con cinque modelli e usa grandezze assolute soltanto quando il testo le fornisce.

- `doppler_observer_moving` — `FIS-OND-DOP-001`: `f=960 Hz`, `f'=1055 Hz`, `v=343 m/s`, da cui `v_o≈33,94 m/s`. I fronti d'onda restano quelli di una sorgente ferma; cambia la velocità con cui l'osservatore li incontra.
- `doppler_source_moving` — `FIS-OND-DOP-002`: il problema è risolto interamente con `beta=v_s/v`; `f'/f=1/(1-beta)` e il raddoppio richiede `beta=0,5`. Nessuna frequenza o velocità del suono assoluta viene inventata.
- `string_mode` — `FIS-OND-COR-001`: a `L` e `T` costanti vale `f/f0=1/sqrt(mu/mu0)`. La configurazione usa una scala didattica `mu/mu0` da 1 a 4 solo per rendere visibile la dipendenza, senza attribuirla alle corde reali del quesito.
- `mechanical_wave_energy` — `FIS-OND-MEC-001`: usa solo coordinate normalizzate `A/Aref` ed `E/Eref=(A/Aref)^2`, coerenti con `Emax=1/2 k A^2`; non vengono inventati `k`, ampiezza o periodo.
- `echo_time_of_flight` — `FIS-OND-SUO-001`: il cursore è `t/Delta t` dell'intero viaggio; a 0,5 l'impulso raggiunge l'ostacolo e a 1 torna al sonar, visualizzando direttamente `2d=v Delta t`.

Le viste distinguono fronti d'onda, modo fondamentale della corda, misura energetica con galleggiante e impulso sonar. Il playback non è tempo fisico nei modelli parametrico/normalizzati; lo è, in forma normalizzata, soltanto nel modello di tempo di volo.

## `fluid_statics`: copertura corrente

L'engine serve otto esercizi con:

- `hydrostatic_column` — legge di Stevino e indipendenza dalla forma;
- `floating_body` — galleggiamento e rapporto tra densità;
- `buoyancy_apparent_weight` — peso apparente e dinamometro;
- `hydrostatic_pressure_points` — confronto di pressioni alla stessa quota;
- `hydraulic_press` — principio di Pascal e amplificazione di forza;
- `communicating_vessels` — uguaglianza dei livelli all'equilibrio.

`communicating_vessels` chiude la parte strettamente idrostatica del catalogo
corrente senza introdurre densità, sezioni, volumi o quote metriche non presenti
nel quesito. Il prossimo modello del dominio è `orifice_outflow`, che introduce
moto del fluido e resta quindi concettualmente distinto dall'equilibrio statico.

## `dc_circuit`: copertura corrente

Cinque esercizi, tre modelli:

### `single_loop_topology`

Copre `FIS-CIR-BAS-001`. Confronta circuito aperto e chiuso senza assegnare
valori numerici inesistenti. La vista esplicita generatore, collegamenti e
utilizzatore.

### `charge_flow`

Copre `FIS-CIR-COR-001` e rende visibile

```text
I = Delta Q / Delta t
1 A = 1 C/s
```

La configurazione usa `1 C` in `1 s` soltanto come scala didattica della
definizione SI, dichiarandolo esplicitamente come valore illustrativo.

### `ohmic_resistor`

Copre `FIS-CIR-OHM-001`, `FIS-CIR-OHM-002` e `FIS-CIR-RES-001`.
`FIS-CIR-OHM-002` usa esclusivamente i dati reali del problema:

```text
V = 4 V
R: 8 ohm -> 4 ohm
I: 0.5 A -> 1 A
```

I quesiti teorici usano scale numeriche dichiarate illustrative. La retta V-I
della view è calcolata dalla resistenza corrente e non è un elemento grafico
statico.

## `calorimetry`: copertura corrente

Cinque esercizi, cinque modelli:

### `sensible_heat_compare`

Copre `FIS-TER-CAL-001` con la stessa massa e lo stesso `Q` per rame e
alluminio. La simulazione visualizza due sistemi separati alimentati dalla stessa
sorgente energetica, evitando di suggerire un inesistente trasferimento di
calore tra i materiali.

Il controllo dei dati ha inoltre corretto un metadato preesistente: con
`c_rame=390 J/(kg K)` e `c_alluminio=900 J/(kg K)` il rapporto degli aumenti di
temperatura è circa **2,31**, non 5,8.

### `heating_power`

Copre `FIS-TER-CAL-002`:

```text
Q = eta P t
Delta T = Q/(m c)
```

Qui il cursore può essere interpretato come frazione dell'ora perché la potenza
utile viene assunta costante.

### `thermal_mixing`

Copre `FIS-TER-EQ-001` e mantiene in ogni stato il bilancio energia assorbita +
energia ceduta = 0. Il risultato finale è `44 °C`.

### `ice_water_balance`

Copre `FIS-TER-EQ-002` come processo energetico a tre fasi:

1. riscaldamento del ghiaccio fino a `0 °C`;
2. fusione;
3. riscaldamento dell'acqua fusa fino all'equilibrio.

Prima di usare questo regime, l'engine verifica che l'energia disponibile sia
sufficiente a fondere tutto il ghiaccio. Una configurazione appartenente al
regime di fusione parziale viene rifiutata e richiederà una futura variante
fisica esplicita.

### `phase_change_balance`

Copre `FIS-TER-PAS-001`: il calore latente ceduto dall'oro che solidifica
riscalda l'acqua da `23 °C` a `100 °C` e poi la vaporizza. Il bilancio calcola
circa `4,496 g` d'acqua.

## Schema multi-model

Gli engine multi-model usano varianti `oneOf`: ogni modello conserva un insieme
stretto di parametri e chiavi didattiche. Il validatore continua a rifiutare:

- parametri mancanti;
- chiavi appartenenti a un altro modello;
- valori fuori dai limiti dichiarati;
- configurazioni che corrispondono a zero o più di una variante.

Questo mantiene il contratto più forte man mano che un dominio cresce.

## Fasi aggiornate

### Fase A — massima copertura

Completati:

- `fluid_statics` strettamente idrostatico;
- `dc_circuit`;
- `calorimetry`;
- `ideal_gas_process` per tutti i sei esercizi attuali;
- `ray_optics` per tutti i cinque esercizi di ottica attuali.
- `wave_1d` per tutti i cinque esercizi sulle onde attuali.

Prossimi:

1. `newtonian_particle`;
2. completare `fluid_statics` con `orifice_outflow`.

### Fase B — elettromagnetismo

- `electrostatics_2d`;
- `magnetic_interaction_2d`;
- `electromagnetic_induction`.

### Fase C — modelli specialistici e riuso avanzato

- estendere `one_dimensional_collision`;
- `thermal_expansion`;
- `momentum_system`;
- `heat_engine`.

### Fase D — problemi compositi

Solo dopo che i componenti elementari sono maturi:

- `piecewise_mechanics`;
- urto anelastico seguito da compressione elastica;
- moto su piano inclinato seguito da urto;
- altri problemi multi-fase futuri.

L'orchestrazione deve comporre motori indipendenti e non trasformarsi in un
mega-engine che conosce gli esercizi.

## Stati ammessi nella coverage map

- `implemented`: config e simulazione presenti;
- `planned`: nuovo engine/modello pianificato;
- `extension`: nuova capacità in un engine esistente;
- `composite`: problema multi-fase;
- `not_required`: simulazione interattiva non giustificata.

Priorità:

- `P0`: pilot o caso ad altissimo valore;
- `P1`: alto valore / riuso immediato;
- `P2`: utile ma non prioritario;
- `P3`: differibile o dipendente da altri motori.

## Invariante CI

`scripts/valida_copertura_simulazioni.py` deve fallire se:

- un nuovo esercizio di Fisica manca dalla coverage map;
- la mappa contiene ID non presenti nell'indice;
- un esercizio `implemented` non coincide con il metadato `Simulazione`;
- engine o model non coincidono con la config JSON;
- `not_required` dichiara un engine;
- status, priorità o rationale sono mancanti o non validi.

La CI verifica inoltre:

- formule con test Node DOM-free;
- schema/config e asset graph con test Python;
- build statica;
- Chrome normale, mobile e reduced-motion;
- screenshot di revisione;
- compilazione LaTeX.

## Criterio di maturità

La roadmap può dirsi matura quando:

- il 100% degli esercizi di Fisica resta classificato;
- ogni engine nuovo è provato con almeno due esercizi reali quando il catalogo lo permette;
- ogni modello dichiara ipotesi e limiti fisici;
- browser review, reduced-motion, mobile, test numerici e validazione archivio restano verdi;
- i problemi compositi sono costruiti per composizione e non con hardcoding per esercizio.

Il traguardo **37/58** non conclude la roadmap: chiude i domini correnti di gas perfetti, ottica geometrica e onde e sposta la priorità di Fase A verso la dinamica newtoniana e il completamento della fluidostatica con il modello di efflusso.
