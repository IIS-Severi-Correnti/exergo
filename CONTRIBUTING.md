# Contribuire all'archivio

Questo archivio deve restare leggibile anche per chi conosce LaTeX, GitHub e un
po' di Python, ma non sviluppa software di mestiere. Le modifiche devono quindi
privilegiare chiarezza, ordine e coerenza.

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

## Anonimizzazione

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

Se LaTeX e installato, compilare anche le verifiche:

```bash
python scripts/compila_verifiche.py
```
