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

## Fotografia corrente

L'indice contiene **58 esercizi di Fisica**.

| Stato | Numero | Significato |
|---|---:|---|
| `implemented` | 13 | Simulazione già collegata nell'indice e coperta dalla CI |
| `planned` | 36 | Copribile direttamente da un engine/modello pianificato |
| `extension` | 5 | Copribile estendendo un engine già esistente |
| `composite` | 2 | Richiede più fasi/modelli coordinati |
| `not_required` | 2 | Simulazione completa non giustificata didatticamente |

**56 esercizi su 58** hanno una traiettoria verso un modello interattivo; i due `not_required` restano intenzionalmente fuori dalla copertura con engine.

Gli engine attivi sono:

- `rotational_platform` — 2 esercizi, modello `textbook_reduced_system`;
- `ideal_gas_process` — 2 esercizi, modello `reversible_isothermal`;
- `one_dimensional_collision` — 1 esercizio, modello `elastic_1d`;
- `fluid_statics` — 8 esercizi, modelli `hydrostatic_column`, `floating_body`, `buoyancy_apparent_weight`, `hydrostatic_pressure_points`, `hydraulic_press` e `communicating_vessels`.

`fluid_statics` è il primo engine Exergo che dimostra esplicitamente **riuso sia tra configurazioni sia tra modelli fisici distinti nello stesso dominio**.

## Regola di priorità

Per ordinare il backlog usiamo una metrica euristica:

```text
priority_score = incremental_exercises * didactic_value / implementation_complexity
```

dove `didactic_value` e `implementation_complexity` sono valutati su scala 1–5. Il punteggio serve a scegliere dove investire, ma non sostituisce la revisione fisica o architetturale.

## Backlog ordinato dopo `communicating_vessels`

| # | Engine | Tipo | Esercizi incrementali | Valore didattico | Complessità | Score | Ambito |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | `dc_circuit` | nuovo engine | 5 | 4 | 3 | 6.67 | Circuito semplice, corrente e legge di Ohm |
| 2 | `calorimetry` | nuovo engine | 5 | 4 | 3 | 6.67 | Calore specifico, riscaldamento, equilibrio e passaggi di stato |
| 3 | `ideal_gas_process` | estensione engine esistente | 4 | 5 | 3 | 6.67 | Isocora, isobara, trasformazioni composte e cicli |
| 4 | `ray_optics` | nuovo engine | 5 | 5 | 4 | 6.25 | Snell, riflessione totale, lastra parallela e specchio concavo |
| 5 | `wave_1d` | nuovo engine | 5 | 5 | 4 | 6.25 | Doppler, onde su corde, energia ed eco/sonar |
| 6 | `newtonian_particle` | nuovo engine | 4 | 5 | 4 | 5.00 | Forze costanti 2D e piano inclinato con attrito |
| 7 | `electrostatics_2d` | nuovo engine | 3 | 5 | 4 | 3.75 | Campo puntiforme, Coulomb e confronto inverse-square |
| 8 | `magnetic_interaction_2d` | nuovo engine | 3 | 4 | 4 | 3.00 | Oersted, fili paralleli e forza di Lorentz |
| 9 | `electromagnetic_induction` | nuovo engine | 2 | 5 | 4 | 2.50 | Faraday-Lenz e variazione di flusso |
| 10 | `one_dimensional_collision` | estensione engine esistente | 1 | 5 | 2 | 2.50 | Urti elastici successivi tra più corpi |
| 11 | `piecewise_mechanics` | orchestrazione composita | 2 | 5 | 5 | 2.00 | Problemi a fasi: dinamica/urto/molla |
| 12 | `fluid_statics` | estensione engine attivo | 1 | 5 | 3 | 1.67 | Getti da fori a diversa profondità |
| 13 | `thermal_expansion` | nuovo engine | 1 | 3 | 2 | 1.50 | Dilatazione termica dei solidi |
| 14 | `momentum_system` | nuovo engine | 1 | 4 | 3 | 1.33 | Rinculo e sequenze di lanci |
| 15 | `heat_engine` | nuovo engine | 1 | 4 | 3 | 1.33 | Rendimento e macchina di Carnot |

## `fluid_statics`: copertura corrente

### `hydrostatic_column`

Copre:

- `FIS-FLU-PID-001`: problema numerico con due recipienti, inclusa la dimostrazione che il raggio non influenza la pressione idrostatica;
- `FIS-FLU-PID-002`: riuso dello stesso modello come esploratore della legge `Δp=ρgh`, con valori numerici dichiarati esplicitamente come scala didattica e non come dati del quesito.

### `floating_body`

Copre:

- `FIS-FLU-ARC-001`: la densità della cassa `480 kg/m³` porta all'equilibrio con il **48% del volume immerso**;
- `FIS-FLU-ARC-003`: lo stesso modello diventa esploratore qualitativo di peso, spinta di Archimede, densità e frazione immersa.

Il modello usa come coordinata la frazione `V_imm/V_tot`, non un tempo fittizio, e rende esplicita la relazione

```text
F_A / P = (ρ_f / ρ_c) * (V_imm / V_tot)
```

permettendo di distinguere:

- `ρ_c < ρ_f`: equilibrio di galleggiamento con immersione parziale;
- `ρ_c = ρ_f`: equilibrio neutro a immersione completa;
- `ρ_c > ρ_f`: la massima spinta non compensa il peso e il corpo affonda.

Non vengono inventati massa o volume assoluti quando l'esercizio non li fornisce.

### `buoyancy_apparent_weight`

Copre `FIS-FLU-ARC-002`. Il testo dell'esercizio rende ora espliciti `ρ_mare=1030 kg/m³` e `g=9,8 m/s²`, così dati e soluzione sono autosufficienti. Il modello usa le due letture del dinamometro per ricavare

```text
F_A = P - P_app
V = F_A / (ρ_f g)
m = P / g
ρ_c = m / V
```

e riusa internamente `floating_body` per descrivere la crescita della spinta con la frazione di volume immerso. La vista aggiunge il terzo vettore di forza, la tensione del dinamometro, e mantiene in ogni stato il bilancio quasi-statico `T + F_A = P`.

### `hydrostatic_pressure_points`

Copre `FIS-FLU-PID-003` senza trasformare i valori illustrativi in dati del quesito. Il motore riusa la stessa funzione `Δp=ρgh` di `hydrostatic_column`: nello stato iniziale il punto mobile B coincide con il livello di A, quindi

```text
p_A = p_B < p_C = p_D = p_E
```

Durante l'esplorazione B scende tra i due livelli e infine raggiunge C-D-E. I punti C, D ed E restano a coordinate orizzontali diverse ma alla stessa profondità, rendendo visivamente esplicito che la pressione idrostatica non dipende dalla posizione orizzontale. Le profondità metriche e i pascal mostrati dalla vista sono dichiarati come **scala didattica**, non come dati originali dell'esercizio.

### `hydraulic_press`

Copre `FIS-FLU-PAS-001`. Il modello usa direttamente i dati del problema, `F₁=140 N`, `m=3800 kg` e `g=9,8 m/s²`, e calcola

```text
P = mg
F₁/A₁ = F₂/A₂
F₂ = F₁ * (A₂/A₁)
A₂/A₁ = mg/F₁ = 266
```

La coordinata interattiva è il rapporto dimensionale `A₂/A₁`, da `1` al valore minimo necessario per equilibrare l'automobile. Non vengono introdotte aree assolute né diametri non forniti dal testo; le larghezze dei pistoni nella vista sono dichiarate schematiche e non in scala. Il playback modifica un parametro di progetto e non rappresenta tempo fisico.

### `communicating_vessels`

Copre `FIS-FLU-VAS-001` senza introdurre densità, quote metriche, sezioni o volumi assenti dal quesito. La config contiene soltanto `branch_count=4`, dato strutturale esplicito nel testo. Il motore usa scarti di livello normalizzati per confrontare stati:

```text
p_i = p_0 + ρ g h_i
stesso p_0, stessa ρ e stesso g
p_i = p_j  <=>  h_i = h_j
```

Il parametro di avanzamento riduce un indicatore di dislivello da `1` a `0`; non rappresenta tempo fisico e non simula un travaso volume-conservativo. Le forme diverse dei recipienti appartengono alla vista e non modificano la condizione idrostatica di equilibrio.

## Schema multi-model

Con più modelli, il manifest di `fluid_statics` usa varianti `oneOf`: ogni modello conserva un proprio insieme stretto di parametri, controlli, opzioni di visualizzazione e testi didattici obbligatori.

Il validatore Python supporta il sottoinsieme `oneOf` necessario a Exergo e continua a rifiutare:

- parametri mancanti per il modello selezionato;
- chiavi appartenenti a un altro modello;
- valori fuori dai limiti numerici dichiarati;
- configurazioni che non corrispondono esattamente a una variante.

Questo evita di indebolire la validazione del repository man mano che un engine acquisisce più modelli.

## Prossimi modelli `fluid_statics`

1. **`orifice_outflow`** — `FIS-FLU-PID-004`, mantenuto separato dalla parte strettamente idrostatica perché introduce il moto del fluido.

Con `communicating_vessels` la parte strettamente idrostatica del catalogo corrente è coperta. Il prossimo modello `fluid_statics` è **`orifice_outflow`**, che costituisce il passaggio controllato dall'equilibrio statico al moto del fluido e va quindi trattato come estensione concettualmente distinta.

## Fasi

### Fase A — massima copertura

1. `dc_circuit`;
2. `calorimetry`;
3. estendere `ideal_gas_process`;
4. `ray_optics`;
5. `wave_1d`;
6. `newtonian_particle`;
7. completare `fluid_statics` con `orifice_outflow`.

### Fase B — elettromagnetismo

8. `electrostatics_2d`;
9. `magnetic_interaction_2d`;
10. `electromagnetic_induction`.

### Fase C — modelli specialistici e riuso avanzato

11. estendere `one_dimensional_collision`;
12. `thermal_expansion`;
13. `momentum_system`;
14. `heat_engine`.

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
