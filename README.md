# Archivio LaTeX di esercizi di Matematica e Fisica

Questo progetto organizza esercizi di Matematica e Fisica in formato LaTeX come
una banca dati didattica riutilizzabile. Non e una semplice raccolta di vecchie
verifiche: ogni esercizio e autonomo, classificato con metadati e pensato per
essere cercato, selezionato e ricombinato in nuove verifiche.

L'obiettivo iniziale e un MVP semplice: file ordinati, tassonomia coerente,
indice CSV generato automaticamente e pochi script Python senza dipendenze
esterne.

## Struttura del repository

```text
metadata/              Tassonomia e indice CSV degli esercizi
templates/             Preamboli e modelli LaTeX
esercizi/              Esercizi singoli divisi per disciplina e argomento
verifiche_generate/    Verifiche create dagli script
archivio_originale/    Materiale sorgente da ripulire e anonimizzare
scripts/               Script Python per indice, ricerca e generazione
```

## Convenzione degli ID

Gli ID devono essere leggibili e stabili:

```text
MAT-GAN-ELL-001
FIS-TER-DIL-001
FIS-TER-EQ-001
FIS-DIN-NEW-004
```

La struttura consigliata e:

```text
DISCIPLINA-AREA-ARGOMENTO-NUMERO
```

Esempi:

- `MAT` = Matematica
- `FIS` = Fisica
- `GAN` = Geometria analitica
- `TER` = Termologia
- `ELL` = Ellisse
- `DIL` = Dilatazione
- `EQ` = Equilibrio termico

## Formato di un esercizio

Ogni esercizio e un file `.tex` autonomo. Deve iniziare con metadati in commenti
LaTeX:

```tex
% ID: FIS-TER-EQ-001
% Titolo: Miscela di acqua calda e fredda
% Disciplina: Fisica
% Area: Termologia
% Argomento: Temperatura di equilibrio
% Sottoargomento: Calorimetria senza dispersioni
% Classe: Seconda liceo scientifico
% Difficolta: 3
% Tipo: problema_numerico
% Risultato: 44 ^\circ C
% Tempo_stimato: 8 min
% Competenze: modellizzazione, proporzionalita, conservazione dell'energia
% Prerequisiti: calore specifico, equilibrio termico
% Tag: termologia, calorimetria, temperatura_equilibrio, acqua
% Fonte: esempio_originale
% Autore: Riccardo Carli
% Licenza: CC-BY-SA-4.0

\begin{esercizio}
Testo dell'esercizio...
\end{esercizio}

\begin{soluzione}
Soluzione dettagliata...
\end{soluzione}
```

Campi obbligatori:

```text
ID, Titolo, Disciplina, Area, Argomento, Classe, Difficolta, Tipo, Tag
```

## Difficolta

- `1`: esercizio meccanico, applicazione diretta
- `2`: esercizio standard con un passaggio ragionato
- `3`: esercizio da verifica ordinaria
- `4`: esercizio impegnativo, richiede scelta di strategia
- `5`: esercizio eccellente, avanzato, olimpiadico o di selezione

## Tipi di esercizio

Valori standard per il campo `Tipo`:

```text
problema_numerico
dimostrazione
quesito_teorico
scelta_multipla
vero_falso
completamento
grafico
modellizzazione
laboratorio
stima_ordine_grandezza
errore_da_correggere
```

## Aggiungere un nuovo esercizio

1. Scegliere la cartella corretta in `esercizi/`.
2. Creare un file `.tex` con ID coerente con disciplina, area e argomento.
3. Inserire i metadati iniziali.
4. Scrivere il testo dentro `\begin{esercizio}...\end{esercizio}`.
5. Scrivere la soluzione dentro `\begin{soluzione}...\end{soluzione}`.
6. Rigenerare l'indice:

```bash
python scripts/genera_indice.py
```

## Validare l'archivio

Prima di proporre modifiche, rigenerare l'indice e controllare l'archivio:

```bash
python scripts/genera_indice.py
python scripts/valida_archivio.py
```

Il validatore controlla metadati obbligatori, ID duplicati, coerenza con la
tassonomia, difficolta, tipo di esercizio, ambienti LaTeX principali e
placeholder di soluzioni non completate.

Su GitHub gli stessi controlli vengono eseguiti automaticamente a ogni push e
pull request.

## Estrarre candidati da archivi Overleaf

Gli ZIP originali delle verifiche non vanno pubblicati automaticamente. Per
lavorare in locale si puo usare:

```bash
python scripts/estrai_candidati_zip.py \
  --fisica "C:\percorso\Verifiche Fisica LaTeX.zip" \
  --matematica "C:\percorso\Verifiche Matematica LaTeX.zip"
```

Lo script crea file in `import_lavorazione/`, cartella ignorata da Git. I file
estratti sono solo candidati: prima di spostarli in `esercizi/` vanno
revisionati, anonimizzati, classificati e dotati di metadati completi.

## Cercare esercizi

Esempi:

```bash
python scripts/cerca_esercizi.py --disciplina Fisica --area Termologia
python scripts/cerca_esercizi.py --tag calorimetria
python scripts/cerca_esercizi.py --argomento "Temperatura di equilibrio" --difficolta 3
python scripts/cerca_esercizi.py --disciplina Matematica --area "Geometria analitica" --tag ellisse
```

## Generare una verifica

Prima rigenerare l'indice:

```bash
python scripts/genera_indice.py
```

Poi generare la verifica:

```bash
python scripts/genera_verifica.py \
  --titolo "Verifica di Fisica - Termologia" \
  --classe "Seconda liceo scientifico" \
  --data "15 marzo 2026" \
  --ids FIS-TER-DIL-001 FIS-TER-CAL-001 FIS-TER-EQ-001 \
  --output verifiche_generate/fisica/verifica_termologia_001.tex \
  --soluzioni false
```

Per mostrare le soluzioni usare `--soluzioni true`.

## Compilare le verifiche

Per controllare che le verifiche generate e le soluzioni compilino
correttamente serve un'installazione LaTeX con `latexmk` oppure `pdflatex`.

```bash
python scripts/compila_verifiche.py
```

Lo script compila i file `.tex` in `verifiche_generate/` e crea anche un
documento temporaneo con tutti gli esercizi e le soluzioni attive. Per
mantenere PDF, log e file ausiliari:

```bash
python scripts/compila_verifiche.py --keep-artifacts
```

## Privacy

Prima di pubblicare materiali derivati da verifiche reali, eliminare:

- nomi di studenti;
- dati personali;
- riferimenti a BES, DSA, PDP;
- voti;
- note disciplinari;
- riferimenti troppo specifici a classi reali;
- intestazioni scolastiche non autorizzate;
- date e circostanze che possano rendere identificabili studenti o situazioni.

## Licenza

Licenza consigliata: CC BY-SA 4.0.

Il file `LICENSE` contiene per ora un riferimento placeholder. Prima della
pubblicazione definitiva va confermato che tutti i materiali possano essere
rilasciati con questa licenza.
