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
| `implemented` | 23 | Simulazione collegata all'esercizio e coperta dalla CI |
| `planned` | 26 | Copribile direttamente da un engine/modello pianificato |
| `extension` | 5 | Copribile estendendo un engine già esistente |
| `composite` | 2 | Richiede più fasi/modelli coordinati |
| `not_required` | 2 | Simulazione completa non giustificata didatticamente |

**56 esercizi su 58** hanno una traiettoria verso un modello interattivo; i due
`not_required` restano intenzionalmente fuori dalla copertura con engine.

Gli engine attivi sono:

- `rotational_platform` — 2 esercizi, modello `textbook_reduced_system`;
- `ideal_gas_process` — 2 esercizi, modello `reversible_isothermal`;
- `one_dimensional_collision` — 1 esercizio, modello `elastic_1d`;
- `fluid_statics` — 8 esercizi, 6 modelli;
- `dc_circuit` — 5 esercizi, 3 modelli;
- `calorimetry` — 5 esercizi, 5 modelli.

L'espansione `dc_circuit` + `calorimetry` porta il catalogo simulato da 13 a
**23 esercizi**, aggiungendo due domini completi e dieci esempi pubblicati senza
creare implementazioni one-off.

## Regola di priorità

Per ordinare il backlog usiamo la metrica euristica:

```text
priority_score = incremental_exercises * didactic_value / implementation_complexity
```

dove `didactic_value` e `implementation_complexity` sono valutati su scala 1–5.
Il punteggio ordina l'investimento, ma non sostituisce revisione fisica,
architetturale o didattica.

## Backlog dopo l'espansione circuiti + calorimetria

| # | Engine | Tipo | Esercizi incrementali | Valore didattico | Complessità | Score | Ambito |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `ideal_gas_process` | estensione engine esistente | 4 | 5 | 3 | 6.67 | Isocora, isobara, trasformazioni composte e cicli |
| 2 | `ray_optics` | nuovo engine | 5 | 5 | 4 | 6.25 | Snell, riflessione totale, lastra parallela e specchio concavo |
| 3 | `wave_1d` | nuovo engine | 5 | 5 | 4 | 6.25 | Doppler, onde su corde, energia ed eco/sonar |
| 4 | `newtonian_particle` | nuovo engine | 4 | 5 | 4 | 5.00 | Forze costanti 2D e piano inclinato con attrito |
| 5 | `electrostatics_2d` | nuovo engine | 3 | 5 | 4 | 3.75 | Campo puntiforme, Coulomb e confronto inverse-square |
| 6 | `magnetic_interaction_2d` | nuovo engine | 3 | 4 | 4 | 3.00 | Oersted, fili paralleli e forza di Lorentz |
| 7 | `electromagnetic_induction` | nuovo engine | 2 | 5 | 4 | 2.50 | Faraday-Lenz e variazione di flusso |
| 8 | `one_dimensional_collision` | estensione engine esistente | 1 | 5 | 2 | 2.50 | Urti elastici successivi tra più corpi |
| 9 | `piecewise_mechanics` | orchestrazione composita | 2 | 5 | 5 | 2.00 | Problemi a fasi: dinamica/urto/molla |
| 10 | `fluid_statics` | estensione engine attivo | 1 | 5 | 3 | 1.67 | Getti da fori a diversa profondità |
| 11 | `thermal_expansion` | nuovo engine | 1 | 3 | 2 | 1.50 | Dilatazione termica dei solidi |
| 12 | `momentum_system` | nuovo engine | 1 | 4 | 3 | 1.33 | Rinculo e sequenze di lanci |
| 13 | `heat_engine` | nuovo engine | 1 | 4 | 3 | 1.33 | Rendimento e macchina di Carnot |

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
- `calorimetry`.

Prossimi:

1. estendere `ideal_gas_process`;
2. `ray_optics`;
3. `wave_1d`;
4. `newtonian_particle`;
5. completare `fluid_statics` con `orifice_outflow`.

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

Il traguardo **23/58** non conclude la roadmap, ma costituisce un checkpoint
sufficientemente ricco per una revisione didattica del sito prima della
successiva espansione.
