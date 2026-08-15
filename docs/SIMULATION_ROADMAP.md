# Simulation Coverage Map e roadmap

Questa roadmap trasforma le simulazioni da funzionalità sperimentale a livello strutturale di Exergo.

## Principio

L'obiettivo non è associare un'animazione a ogni esercizio. L'obiettivo è:

1. classificare il 100% degli esercizi di Fisica rispetto alla simulabilità;
2. costruire motori riutilizzabili per i modelli fisici significativi;
3. evitare codice specifico per singolo esercizio;
4. dichiarare esplicitamente i casi in cui una simulazione non aggiunge abbastanza valore didattico;
5. rendere la copertura verificabile dalla CI.

La fonte machine-readable è [`metadata/simulation_coverage.csv`](../metadata/simulation_coverage.csv).

## Fotografia v1

L'indice corrente contiene **58 esercizi di Fisica**.

| Stato | Numero | Significato |
|---|---:|---|
| `implemented` | 5 | Simulazione già pubblicata e collegata nell'indice |
| `planned` | 44 | Copribile direttamente da un engine pianificato |
| `extension` | 5 | Copribile estendendo un engine già esistente |
| `composite` | 2 | Richiede più fasi/modelli coordinati |
| `not_required` | 2 | Simulazione completa non giustificata didatticamente |

Quindi **56 esercizi su 58** hanno già una traiettoria verso un modello interattivo; i due `not_required` restano intenzionalmente fuori dalla copertura con engine.

Gli engine attivi sono:

- `rotational_platform` — 2 esercizi, modello `textbook_reduced_system`;
- `ideal_gas_process` — 2 esercizi pubblicati, modello `reversible_isothermal`;
- `one_dimensional_collision` — 1 esercizio pubblicato, modello `elastic_1d`.

## Regola di priorità

Per ordinare il backlog usiamo una metrica euristica:

```text
priority_score = incremental_exercises * didactic_value / implementation_complexity
```

dove `didactic_value` e `implementation_complexity` sono valutati su scala 1–5.

Il punteggio non sostituisce la revisione fisica o architetturale: serve solo a scegliere dove investire per primo.

## Backlog ordinato

| # | Engine | Tipo | Esercizi incrementali | Valore didattico | Complessità | Score | Ambito |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `fluid_statics` | nuovo engine | 9 | 5 | 3 | 15.00 | Fluidostatica: Archimede, Stevino, Pascal, vasi comunicanti, getti |
| 2 | `dc_circuit` | nuovo engine | 5 | 4 | 3 | 6.67 | Circuito semplice, corrente e legge di Ohm |
| 3 | `calorimetry` | nuovo engine | 5 | 4 | 3 | 6.67 | Calore specifico, riscaldamento, equilibrio e passaggi di stato |
| 4 | `ideal_gas_process` | estensione engine esistente | 4 | 5 | 3 | 6.67 | Isocora, isobara, trasformazioni composte e cicli |
| 5 | `ray_optics` | nuovo engine | 5 | 5 | 4 | 6.25 | Snell, riflessione totale, lastra parallela e specchio concavo |
| 6 | `wave_1d` | nuovo engine | 5 | 5 | 4 | 6.25 | Doppler, onde su corde, energia ed eco/sonar |
| 7 | `newtonian_particle` | nuovo engine | 4 | 5 | 4 | 5.00 | Forze costanti 2D e piano inclinato con attrito |
| 8 | `electrostatics_2d` | nuovo engine | 3 | 5 | 4 | 3.75 | Campo puntiforme, Coulomb e confronto inverse-square |
| 9 | `magnetic_interaction_2d` | nuovo engine | 3 | 4 | 4 | 3.00 | Oersted, fili paralleli e forza di Lorentz |
| 10 | `electromagnetic_induction` | nuovo engine | 2 | 5 | 4 | 2.50 | Faraday-Lenz e variazione di flusso |
| 11 | `one_dimensional_collision` | estensione engine esistente | 1 | 5 | 2 | 2.50 | Urti elastici successivi tra più corpi |
| 12 | `piecewise_mechanics` | orchestrazione composita | 2 | 5 | 5 | 2.00 | Problemi a fasi: dinamica/urto/molla |
| 13 | `thermal_expansion` | nuovo engine | 1 | 3 | 2 | 1.50 | Dilatazione termica dei solidi |
| 14 | `momentum_system` | nuovo engine | 1 | 4 | 3 | 1.33 | Rinculo e sequenze di lanci |
| 15 | `heat_engine` | nuovo engine | 1 | 4 | 3 | 1.33 | Rendimento e macchina di Carnot |

## Prossimo motore: `fluid_statics`

Il censimento modifica l'ordine intuitivo iniziale: **fluidostatica è il miglior prossimo investimento**, perché un unico engine può coprire 9 esercizi con complessità moderata.

Modelli previsti:

- `floating_body`
- `buoyancy_apparent_weight`
- `hydrostatic_column`
- `hydrostatic_pressure_points`
- `hydraulic_press`
- `communicating_vessels`
- `orifice_outflow`

Il primo pilot dovrebbe essere `FIS-FLU-ARC-001` oppure `FIS-FLU-PID-001`: entrambi hanno dati semplici, grandezze fisiche ben definite e una resa visuale forte. La scelta finale va fatta dopo l'audit dei testi completi e della possibilità di riuso del primo modello.

## Fasi

### Fase A — massima copertura

1. `fluid_statics`
2. `dc_circuit`
3. `calorimetry`
4. estensione `ideal_gas_process`
5. `ray_optics`
6. `wave_1d`
7. `newtonian_particle`

### Fase B — elettromagnetismo

8. `electrostatics_2d`
9. `magnetic_interaction_2d`
10. `electromagnetic_induction`

### Fase C — modelli specialistici e riuso avanzato

11. estensione `one_dimensional_collision`
12. `thermal_expansion`
13. `momentum_system`
14. `heat_engine`

### Fase D — problemi compositi

Solo dopo che i componenti elementari sono maturi:

- `piecewise_mechanics`;
- urto anelastico seguito da compressione elastica;
- moto su piano inclinato seguito da urto;
- altri problemi multi-fase futuri.

L'orchestrazione non deve trasformarsi in un mega-engine che conosce gli esercizi: deve comporre modelli indipendenti.

## Stati ammessi nella coverage map

- `implemented`: config e simulazione già presenti;
- `planned`: nuovo engine/modello pianificato;
- `extension`: nuovo modello o capacità in un engine esistente;
- `composite`: problema che richiede più fasi fisiche;
- `not_required`: esercizio per cui un engine interattivo non è giustificato.

Priorità:

- `P0`: pilot o caso ad altissimo valore;
- `P1`: alto valore / riuso immediato;
- `P2`: utile ma non prioritario;
- `P3`: differibile o dipendente da altri motori.

## Invariante CI

`scripts/valida_copertura_simulazioni.py` deve fallire se:

- un nuovo esercizio di Fisica non compare nella coverage map;
- la mappa contiene ID non presenti nell'indice di Fisica;
- un esercizio `implemented` non coincide con il metadato `Simulazione` dell'indice;
- engine o model dichiarati non coincidono con la config JSON pubblicata;
- `not_required` dichiara comunque un engine;
- status, priorità o rationale sono mancanti/non validi.

Il test `tests/test_simulation_coverage.py` fa parte della normale suite Python già eseguita dalla CI. In questo modo la copertura rimane parte del contratto del repository, non un documento da mantenere a memoria.

## Criterio di completamento della roadmap

La roadmap può dirsi matura quando:

- il 100% degli esercizi di Fisica resta classificato;
- ogni engine nuovo è provato con almeno due esercizi reali quando il catalogo lo permette;
- ogni modello dichiara ipotesi e limiti fisici;
- browser review, reduced-motion, mobile, test numerici e validazione archivio restano verdi;
- i problemi compositi sono costruiti per composizione e non con hardcoding per esercizio.
