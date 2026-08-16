# Contribuire all'archivio

Questo archivio deve restare leggibile anche per chi conosce LaTeX, GitHub e un
po' di Python, ma non sviluppa software di mestiere. Le modifiche devono quindi
privilegiare chiarezza, ordine e coerenza.

## Flusso di lavoro

Per modifiche non banali:

1. partire da `main` aggiornato;
2. creare un branch dedicato;
3. modificare solo i file necessari;
4. eseguire i controlli pertinenti;
5. aprire una pull request;
6. mergiare solo con CI verde e senza blocker noti.

Evitare modifiche dirette a `main`. La protezione amministrativa del branch e
un requisito della prima release stabile; fino a quando non e attiva, questa
regola deve essere rispettata operativamente.

I workflow GitHub Actions creati per una singola migrazione, patch o
sincronizzazione non devono restare in `main`. Le automazioni permanenti devono
avere uno scopo generale e ripetibile.

## Nominare un nuovo esercizio

Usare ID leggibili:

```text
DISCIPLINA-AREA-ARGOMENTO-NUMERO
```

Esempi:

```text
FIS-TER-DIL-001
FIS-TER-EQ-001
MAT-GAN-ELL-001
```

Il file deve avere lo stesso ID:

```text
esercizi/fisica/termologia/dilatazione_lineare/FIS-TER-DIL-001.tex
```

## Metadati obbligatori

Ogni file deve iniziare con questi campi:

```tex
% ID:
% Titolo:
% Disciplina:
% Area:
% Argomento:
% Classe:
% Difficolta:
% Tipo:
% Tag:
```

Sono consigliati anche:

```tex
% Sottoargomento:
% Risultato:
% Tempo_stimato:
% Competenze:
% Prerequisiti:
% Fonte:
% Autore:
% Licenza:
```

## Tag

I tag devono essere pochi, utili e riusabili. Preferire parole in minuscolo con
underscore:

```text
termologia, calorimetria, temperatura_equilibrio, acqua
```

Evitare tag troppo personali o occasionali, come `bella_domanda` o
`verifica_3b_maggio`.

## Difficolta e tipo

Usare la scala 1-5:

- `1`: applicazione diretta
- `2`: standard con un passaggio ragionato
- `3`: verifica ordinaria
- `4`: impegnativo
- `5`: avanzato o selettivo

Usare i tipi standard definiti in `metadata/tassonomia.yml`, per esempio
`problema_numerico`, `quesito_teorico`, `dimostrazione`, `grafico`.

## Anonimizzazione e provenienza

Prima di proporre materiale derivato da verifiche reali, eliminare:

- nomi di studenti;
- dati personali;
- riferimenti a BES, DSA, PDP;
- voti;
- note disciplinari;
- riferimenti troppo specifici a classi reali;
- intestazioni scolastiche non autorizzate;
- date e circostanze che possano rendere identificabili studenti o situazioni.

Se un esercizio conserva una fonte, usare nomi generici come
`verifica_termologia_anonimizzata`.

Prima di assegnare una licenza a materiale importato, verificare che autore e
provenienza consentano realmente la redistribuzione. Una dichiarazione di
licenza non sostituisce questa verifica.

## Simulazioni

Un engine deve rappresentare un modello o un dominio fisico riutilizzabile, non
un singolo esercizio. Prima di introdurre un nuovo engine verificare se il caso
puo essere espresso come configurazione o modello aggiuntivo di un engine gia
esistente.

Quando un quesito non fornisce dati numerici sufficienti, usare rapporti
adimensionali, coordinate normalizzate o scale didattiche chiaramente
dichiarate invece di inventare dati del problema.

## Prima di proporre modifiche

Rigenerare l'indice:

```bash
python scripts/genera_indice.py
```

Validare l'archivio:

```bash
python scripts/valida_archivio.py
```

Controllare che non ci siano errori su metadati mancanti, ID duplicati,
difficolta non valida, tipi fuori tassonomia o soluzioni ancora da completare.

Eseguire inoltre le suite pertinenti alla modifica. Per le simulazioni sono
richiesti i test Node e, quando la UI cambia, gli smoke test browser con controllo
mobile e reduced-motion.

Se LaTeX e installato, compilare anche le verifiche:

```bash
python scripts/compila_verifiche.py
```

I criteri completi di release sono documentati in
`docs/RELEASE_PROCESS.md`. La pull request template contiene la checklist
standard da completare prima del merge.
