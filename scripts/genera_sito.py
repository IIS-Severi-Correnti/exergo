"""Genera una GitHub Page statica dall'archivio degli esercizi."""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_CSV = ROOT / "metadata" / "indice_esercizi.csv"
DEFAULT_OUTPUT = ROOT / "_site"


@dataclass(frozen=True)
class Exercise:
    row: dict[str, str]
    statement: str
    solution: str

    @property
    def exercise_id(self) -> str:
        return self.row["id"]

    @property
    def title(self) -> str:
        return self.row["titolo"]

    @property
    def path(self) -> Path:
        return Path(self.row["path"])

    @property
    def url(self) -> str:
        return f"esercizi/{self.exercise_id.lower()}/"

    @property
    def source_url(self) -> str:
        return f"sorgenti/{self.path.as_posix()}"


def escape(value: str) -> str:
    return html.escape(value, quote=False)


def escape_attr(value: str) -> str:
    return html.escape(value, quote=True)


def normalize_space(value: str) -> str:
    return " ".join(value.split())


def split_list(value: str) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(";") if part.strip()]


def extract_environment(text: str, environment: str, path: Path) -> str:
    pattern = re.compile(
        rf"\\begin\{{{re.escape(environment)}\}}(.*?)\\end\{{{re.escape(environment)}\}}",
        re.DOTALL,
    )
    match = pattern.search(text)
    if not match:
        raise ValueError(f"{path}: ambiente {environment} non trovato")
    return match.group(1).strip()


def read_exercises() -> list[Exercise]:
    if not INDEX_CSV.exists():
        raise FileNotFoundError(
            f"Indice non trovato: {INDEX_CSV.relative_to(ROOT)}. "
            "Esegui prima scripts/genera_indice.py."
        )

    exercises: list[Exercise] = []
    with INDEX_CSV.open(encoding="utf-8", newline="") as csv_file:
        for row in csv.DictReader(csv_file):
            tex_path = ROOT / row["path"]
            text = tex_path.read_text(encoding="utf-8")
            exercises.append(
                Exercise(
                    row=row,
                    statement=extract_environment(text, "esercizio", tex_path),
                    solution=extract_environment(text, "soluzione", tex_path),
                )
            )

    return sorted(
        exercises,
        key=lambda exercise: (
            exercise.row["disciplina"],
            exercise.row["area"],
            exercise.row["argomento"],
            exercise.row["titolo"],
            exercise.row["id"],
        ),
    )


def render_latex_block(source: str) -> str:
    lines = source.strip().splitlines()
    parts: list[str] = []
    paragraph: list[str] = []
    list_kind: str | None = None
    list_item: list[str] = []

    def flush_paragraph() -> None:
        if not paragraph:
            return
        block = normalize_space("\n".join(paragraph))
        paragraph.clear()
        if block.startswith(r"\[") and block.endswith(r"\]"):
            parts.append(f'<div class="math-block">{escape(block)}</div>')
        else:
            parts.append(f"<p>{escape(block)}</p>")

    def flush_list_item() -> None:
        if not list_item:
            return
        block = normalize_space("\n".join(list_item))
        list_item.clear()
        parts.append(f"<li>{escape(block)}</li>")

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            if list_kind is None:
                flush_paragraph()
            continue

        if line == r"\begin{itemize}":
            flush_paragraph()
            list_kind = "ul"
            parts.append("<ul>")
            continue

        if line == r"\begin{enumerate}":
            flush_paragraph()
            list_kind = "ol"
            parts.append("<ol>")
            continue

        if line in {r"\end{itemize}", r"\end{enumerate}"}:
            flush_list_item()
            if list_kind:
                parts.append(f"</{list_kind}>")
            list_kind = None
            continue

        if list_kind is not None:
            if line.startswith(r"\item"):
                flush_list_item()
                line = line.removeprefix(r"\item").strip()
            list_item.append(line)
            continue

        paragraph.append(line)

    flush_list_item()
    if list_kind:
        parts.append(f"</{list_kind}>")
    flush_paragraph()
    return "\n".join(parts)


def label_value(label: str, value: str) -> str:
    if not value:
        return ""
    return (
        '<div class="meta-item">'
        f"<dt>{escape(label)}</dt>"
        f"<dd>{escape(value)}</dd>"
        "</div>"
    )


def label_value_html(label: str, value_html: str) -> str:
    if not value_html:
        return ""
    return (
        '<div class="meta-item">'
        f"<dt>{escape(label)}</dt>"
        f"<dd>{value_html}</dd>"
        "</div>"
    )


def badge(value: str, class_name: str = "") -> str:
    class_attr = f" {class_name}" if class_name else ""
    return f'<span class="badge{class_attr}">{escape(value)}</span>'


def difficulty_stars(value: str) -> str:
    try:
        difficulty = int(value)
    except ValueError:
        return escape(value)

    difficulty = max(0, min(5, difficulty))
    filled = "".join('<span class="star star-filled" aria-hidden="true">&#9733;</span>' for _ in range(difficulty))
    empty = "".join('<span class="star star-empty" aria-hidden="true">&#9734;</span>' for _ in range(5 - difficulty))
    label = f"Difficolta {difficulty} su 5"
    return (
        f'<span class="difficulty-stars" role="img" aria-label="{escape_attr(label)}" title="{escape_attr(label)}">'
        f"{filled}{empty}"
        f'<span class="difficulty-score">{difficulty}/5</span>'
        "</span>"
    )


def page_shell(title: str, body: str, *, depth: int = 0, script: str = "") -> str:
    prefix = "../" * depth
    return f"""<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>{escape(title)} | Exergo</title>
  <link rel="stylesheet" href="{prefix}assets/style.css">
  <script>
    window.MathJax = {{
      tex: {{
        inlineMath: [["\\\\(", "\\\\)"], ["$", "$"]],
        displayMath: [["\\\\[", "\\\\]"]],
        processEscapes: true
      }},
      options: {{
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
      }}
    }};
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
</head>
<body>
{body}
{script}
</body>
</html>
"""


def render_index(exercises: list[Exercise]) -> str:
    discipline_values = sorted({exercise.row["disciplina"] for exercise in exercises if exercise.row["disciplina"]})
    area_values = sorted({exercise.row["area"] for exercise in exercises if exercise.row["area"]})
    topic_values = sorted({exercise.row["argomento"] for exercise in exercises if exercise.row["argomento"]})
    class_values = sorted({exercise.row["classe"] for exercise in exercises if exercise.row["classe"]})
    type_values = sorted({exercise.row["tipo"] for exercise in exercises if exercise.row["tipo"]})
    difficulty_values = sorted(
        {exercise.row["difficolta"] for exercise in exercises if exercise.row["difficolta"]},
        key=lambda value: int(value) if value.isdigit() else 0,
    )

    def select_control(control_id: str, label: str, values: list[str]) -> str:
        options = [f'<option value="">{escape("Tutti")}</option>']
        options.extend(
            f'<option value="{escape_attr(value)}">{escape(value)}</option>'
            for value in values
        )
        return (
            f'<label for="{control_id}">'
            f"<span>{escape(label)}</span>"
            f'<select id="{control_id}" name="{control_id}">'
            f"{''.join(options)}"
            "</select>"
            "</label>"
        )

    cards = "\n".join(render_index_card(exercise) for exercise in exercises)
    data = json.dumps([exercise_to_json(exercise) for exercise in exercises], ensure_ascii=False, indent=2)

    body = f"""
<main class="page">
  <header class="site-header">
    <div>
      <p class="eyebrow">Exergo</p>
      <h1>Archivio esercizi</h1>
    </div>
    <dl class="site-stats" aria-label="Conteggio archivio">
      <div>
        <dt>Esercizi</dt>
        <dd>{len(exercises)}</dd>
      </div>
      <div>
        <dt>Discipline</dt>
        <dd>{len(discipline_values)}</dd>
      </div>
    </dl>
  </header>

  <section class="archive-layout">
    <aside class="toolbar" aria-label="Filtri esercizi">
      <label class="search-control" for="search">
        <span>Cerca</span>
        <input id="search" name="search" type="search" autocomplete="off" placeholder="ID, titolo, argomento, tag">
      </label>
      {select_control("discipline", "Disciplina", discipline_values)}
      {select_control("area", "Area", area_values)}
      {select_control("topic", "Argomento", topic_values)}
      {select_control("school-class", "Classe", class_values)}
      {select_control("difficulty", "Difficolta", difficulty_values)}
      {select_control("exercise-type", "Tipo", type_values)}
      <button class="reset-button" type="button" id="reset-filters">Azzera</button>
    </aside>

    <section class="catalog" aria-label="Elenco esercizi">
      <div class="catalog-head">
        <div>
          <p class="eyebrow">Disponibili</p>
          <h2>Catalogo</h2>
        </div>
        <div class="result-count" aria-live="polite">
          <strong id="visible-count">{len(exercises)}</strong> esercizi
        </div>
      </div>
      <div class="exercise-list" id="exercise-list">
        {cards}
      </div>
    </section>
  </section>
</main>
<script id="exercise-data" type="application/json">{escape(data)}</script>
"""
    return page_shell(
        "Archivio esercizi",
        body,
        script='<script defer src="assets/app.js"></script>',
    )


def render_index_card(exercise: Exercise) -> str:
    tags = split_list(exercise.row["tag"])
    tag_html = "".join(badge(tag) for tag in tags[:4])
    if len(tags) > 4:
        tag_html += badge(f"+{len(tags) - 4}")

    haystack = " ".join(
        [
            exercise.row["id"],
            exercise.row["titolo"],
            exercise.row["disciplina"],
            exercise.row["area"],
            exercise.row["argomento"],
            exercise.row["sottoargomento"],
            exercise.row["classe"],
            exercise.row["tipo"],
            exercise.row["tag"],
        ]
    )
    discipline_class = "physics" if exercise.row["disciplina"].casefold() == "fisica" else "math"

    time_item = label_value("Tempo", exercise.row["tempo_stimato"])

    return f"""
<article class="exercise-card {discipline_class}"
  data-search="{escape_attr(haystack)}"
  data-discipline="{escape_attr(exercise.row["disciplina"])}"
  data-area="{escape_attr(exercise.row["area"])}"
  data-topic="{escape_attr(exercise.row["argomento"])}"
  data-school-class="{escape_attr(exercise.row["classe"])}"
  data-difficulty="{escape_attr(exercise.row["difficolta"])}"
  data-exercise-type="{escape_attr(exercise.row["tipo"])}">
  <div class="row-marker" aria-hidden="true">
    <span>{escape(exercise.row["disciplina"][:3].upper())}</span>
  </div>
  <div class="exercise-main">
    <div class="card-topline">
      <span>{escape(exercise.row["disciplina"])}</span>
      <span>{escape(exercise.row["area"])}</span>
      <span>{escape(exercise.row["argomento"])}</span>
    </div>
    <h2><a href="{escape_attr(exercise.url)}">{escape(exercise.title)}</a></h2>
    <p class="card-id">{escape(exercise.exercise_id)}</p>
    <div class="tag-row" aria-label="Tag">{tag_html}</div>
  </div>
  <dl class="card-meta">
    {label_value("Classe", exercise.row["classe"])}
    {label_value("Tipo", exercise.row["tipo"])}
    {time_item}
    {label_value_html("Difficolta", difficulty_stars(exercise.row["difficolta"]))}
  </dl>
</article>
"""


def render_exercise_page(exercise: Exercise) -> str:
    tags = "".join(badge(tag) for tag in split_list(exercise.row["tag"]))
    source_link = "../../" + exercise.source_url
    index_link = "../../index.html"

    meta_items = "\n".join(
        item
        for item in [
            label_value("ID", exercise.row["id"]),
            label_value("Disciplina", exercise.row["disciplina"]),
            label_value("Area", exercise.row["area"]),
            label_value("Argomento", exercise.row["argomento"]),
            label_value("Sottoargomento", exercise.row["sottoargomento"]),
            label_value("Classe", exercise.row["classe"]),
            label_value_html("Difficolta", difficulty_stars(exercise.row["difficolta"])),
            label_value("Tipo", exercise.row["tipo"]),
            label_value("Tempo stimato", exercise.row["tempo_stimato"]),
            label_value("Autore", exercise.row["autore"]),
            label_value("Licenza", exercise.row["licenza"]),
        ]
        if item
    )

    result = ""
    if exercise.row["risultato"]:
        result = (
            '<div class="expected-result">'
            "<h2>Risultato</h2>"
            f"<p>{escape(exercise.row['risultato'])}</p>"
            "</div>"
        )

    body = f"""
<main class="page exercise-page">
  <nav class="page-nav" aria-label="Navigazione">
    <a href="{index_link}">Archivio</a>
    <a href="{escape_attr(source_link)}">Sorgente .tex</a>
  </nav>

  <header class="exercise-header">
    <p class="eyebrow">{escape(exercise.exercise_id)}</p>
    <h1>{escape(exercise.title)}</h1>
    <div class="tag-row" aria-label="Tag">{tags}</div>
  </header>

  <dl class="meta-grid">
    {meta_items}
  </dl>

  <section class="content-section">
    <h2>Testo</h2>
    <div class="latex-content">
      {render_latex_block(exercise.statement)}
    </div>
  </section>

  <details class="solution-panel">
    <summary>Soluzione</summary>
    {result}
    <div class="latex-content">
      {render_latex_block(exercise.solution)}
    </div>
  </details>
</main>
"""
    return page_shell(exercise.title, body, depth=2)


def exercise_to_json(exercise: Exercise) -> dict[str, str]:
    return {
        "id": exercise.row["id"],
        "titolo": exercise.row["titolo"],
        "disciplina": exercise.row["disciplina"],
        "area": exercise.row["area"],
        "argomento": exercise.row["argomento"],
        "sottoargomento": exercise.row["sottoargomento"],
        "classe": exercise.row["classe"],
        "difficolta": exercise.row["difficolta"],
        "tipo": exercise.row["tipo"],
        "tempo_stimato": exercise.row["tempo_stimato"],
        "tag": exercise.row["tag"],
        "url": exercise.url,
        "sorgente": exercise.source_url,
    }


STYLE_CSS = """
:root {
  color-scheme: light;
  --ink: #172026;
  --paper: #eef3f2;
  --teal: #006d77;
  --amber: #d99a2b;
  --ink-rgb: 23 32 38;
  --paper-rgb: 238 243 242;
  --teal-rgb: 0 109 119;
  --amber-rgb: 217 154 43;
  --line: rgb(var(--ink-rgb) / 0.14);
  --muted: rgb(var(--ink-rgb) / 0.62);
  --shadow: 0 18px 46px rgb(var(--ink-rgb) / 0.09);
}

* {
  box-sizing: border-box;
}

html {
  background: var(--paper);
}

body {
  margin: 0;
  color: var(--ink);
  background:
    linear-gradient(180deg, rgb(var(--teal-rgb) / 0.10), rgb(var(--paper-rgb) / 0) 360px),
    var(--paper);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.55;
}

a {
  color: var(--teal);
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
}

a:hover {
  color: var(--amber);
}

.page {
  width: min(1240px, calc(100% - 32px));
  margin: 0 auto;
  padding: 30px 0 52px;
}

.site-header,
.exercise-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 0 26px;
}

.exercise-header {
  display: block;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--teal);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  line-height: 1.12;
  letter-spacing: 0;
}

h1 {
  max-width: 900px;
  font-size: clamp(2rem, 4vw, 4rem);
}

h2 {
  font-size: 1.1rem;
}

.site-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(88px, 1fr));
  gap: 10px;
  margin: 0;
}

.site-stats div {
  min-width: 88px;
  padding: 13px 15px;
  background: rgb(var(--paper-rgb) / 0.74);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(12px);
}

.site-stats dt,
.meta-item dt {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.site-stats dd,
.meta-item dd {
  margin: 0;
}

.site-stats dd {
  font-size: 1.6rem;
  font-weight: 800;
}

.archive-layout {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.toolbar {
  display: grid;
  position: sticky;
  top: 16px;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 16px;
  background: rgb(var(--paper-rgb) / 0.82);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px);
}

.toolbar label {
  min-width: 0;
}

.toolbar span {
  display: block;
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

input,
select,
button {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font: inherit;
}

input,
select {
  padding: 0 12px;
  color: var(--ink);
  background: rgb(var(--paper-rgb) / 0.92);
}

input:focus,
select:focus,
button:focus-visible,
a:focus-visible,
summary:focus-visible {
  outline: 3px solid rgb(var(--amber-rgb) / 0.42);
  outline-offset: 2px;
}

button {
  padding: 0 16px;
  color: var(--paper);
  background: var(--teal);
  border-color: var(--teal);
  font-weight: 800;
  cursor: pointer;
}

button:hover {
  color: var(--ink);
  background: var(--amber);
  border-color: var(--amber);
}

.catalog {
  min-width: 0;
}

.catalog-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
  padding: 10px 2px 14px;
  border-bottom: 1px solid var(--line);
}

.catalog-head h2 {
  font-size: 1.35rem;
}

.result-count {
  min-width: max-content;
  color: var(--muted);
  font-weight: 700;
}

.result-count strong {
  color: var(--ink);
  font-size: 1.35rem;
}

.exercise-list {
  display: grid;
  gap: 8px;
}

.exercise-card {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) minmax(240px, 330px);
  gap: 16px;
  align-items: center;
  min-height: 132px;
  padding: 16px;
  background: rgb(var(--paper-rgb) / 0.78);
  border: 1px solid var(--line);
  border-left: 5px solid var(--teal);
  border-radius: 8px;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.exercise-card:hover {
  background: rgb(var(--paper-rgb) / 0.96);
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}

.exercise-card.math {
  border-left-color: var(--amber);
}

.row-marker {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  color: var(--teal);
  background: rgb(var(--teal-rgb) / 0.10);
  border: 1px solid rgb(var(--teal-rgb) / 0.28);
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 900;
}

.exercise-card.math .row-marker {
  color: var(--amber);
  background: rgb(var(--amber-rgb) / 0.13);
  border-color: rgb(var(--amber-rgb) / 0.35);
}

.exercise-main {
  min-width: 0;
}

.exercise-card h2 {
  margin-top: 5px;
  font-size: clamp(1rem, 2vw, 1.2rem);
}

.exercise-card h2 a {
  color: var(--ink);
  text-decoration: none;
}

.exercise-card h2 a:hover {
  color: var(--teal);
  text-decoration: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.2em;
}

.card-topline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.card-topline span + span::before {
  content: "/";
  margin-right: 10px;
  color: rgb(var(--ink-rgb) / 0.34);
}

.card-id {
  margin: 5px 0 0;
  color: var(--teal);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.84rem;
}

.card-meta,
.meta-grid {
  display: grid;
  gap: 10px;
  margin: 0;
}

.card-meta {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
  padding-left: 16px;
  border-left: 1px solid var(--line);
}

.meta-grid {
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
  padding: 18px 0;
}

.meta-item {
  min-width: 0;
}

.meta-item dd {
  overflow-wrap: anywhere;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 3px 9px;
  color: var(--ink);
  background: rgb(var(--ink-rgb) / 0.05);
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
}

.difficulty-stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.star {
  font-size: 1rem;
  line-height: 1;
}

.star-filled {
  color: var(--amber);
}

.star-empty {
  color: rgb(var(--ink-rgb) / 0.22);
}

.difficulty-score {
  margin-left: 5px;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 800;
}

.page-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 0 2px;
}

.page-nav a {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  padding: 0 12px;
  background: rgb(var(--paper-rgb) / 0.78);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-weight: 800;
  text-decoration: none;
}

.content-section,
.solution-panel {
  margin-top: 18px;
  padding: 22px;
  background: rgb(var(--paper-rgb) / 0.82);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.content-section h2,
.solution-panel h2 {
  margin-bottom: 14px;
}

.solution-panel summary {
  min-height: 34px;
  color: var(--teal);
  font-size: 1.1rem;
  font-weight: 900;
  cursor: pointer;
}

.solution-panel[open] summary {
  margin-bottom: 16px;
}

.expected-result {
  margin-bottom: 16px;
  padding: 14px;
  background: rgb(var(--amber-rgb) / 0.14);
  border: 1px solid rgb(var(--amber-rgb) / 0.38);
  border-radius: 8px;
}

.expected-result h2 {
  margin-bottom: 6px;
  color: var(--ink);
  font-size: 0.95rem;
}

.expected-result p {
  margin: 0;
}

.latex-content {
  overflow-wrap: anywhere;
}

.latex-content p {
  margin: 0 0 1rem;
}

.latex-content p:last-child {
  margin-bottom: 0;
}

.latex-content ul,
.latex-content ol {
  margin: 0 0 1rem 1.25rem;
  padding: 0;
}

.latex-content li + li {
  margin-top: 0.35rem;
}

.math-block {
  overflow-x: auto;
  margin: 1rem 0;
  padding: 10px 0;
}

[hidden] {
  display: none !important;
}

@media (max-width: 980px) {
  .site-header {
    align-items: stretch;
    flex-direction: column;
  }

  .archive-layout {
    grid-template-columns: 1fr;
  }

  .toolbar {
    position: static;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-control {
    grid-column: 1 / -1;
  }

  .exercise-card {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .card-meta {
    grid-column: 2;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-left: 0;
    border-left: 0;
  }
}

@media (max-width: 640px) {
  .page {
    width: min(100% - 24px, 1180px);
    padding-top: 14px;
  }

  .toolbar,
  .site-stats {
    grid-template-columns: 1fr;
  }

  .catalog-head {
    align-items: start;
    flex-direction: column;
  }

  .exercise-card {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .row-marker {
    width: auto;
    height: 32px;
    justify-content: start;
    padding: 0 10px;
  }

  .card-meta {
    grid-column: auto;
    grid-template-columns: 1fr;
  }
}
"""


APP_JS = """
const filters = {
  search: document.querySelector("#search"),
  discipline: document.querySelector("#discipline"),
  area: document.querySelector("#area"),
  topic: document.querySelector("#topic"),
  schoolClass: document.querySelector("#school-class"),
  difficulty: document.querySelector("#difficulty"),
  exerciseType: document.querySelector("#exercise-type"),
};

const cards = Array.from(document.querySelectorAll(".exercise-card"));
const visibleCount = document.querySelector("#visible-count");
const resetButton = document.querySelector("#reset-filters");

function normalize(value) {
  return (value || "")
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");
}

function matches(card, key, expected) {
  return !expected || card.dataset[key] === expected;
}

function applyFilters() {
  const query = normalize(filters.search.value.trim());
  let count = 0;

  for (const card of cards) {
    const visible =
      (!query || normalize(card.dataset.search).includes(query)) &&
      matches(card, "discipline", filters.discipline.value) &&
      matches(card, "area", filters.area.value) &&
      matches(card, "topic", filters.topic.value) &&
      matches(card, "schoolClass", filters.schoolClass.value) &&
      matches(card, "difficulty", filters.difficulty.value) &&
      matches(card, "exerciseType", filters.exerciseType.value);

    card.hidden = !visible;
    if (visible) {
      count += 1;
    }
  }

  visibleCount.textContent = String(count);
}

for (const input of Object.values(filters)) {
  input.addEventListener("input", applyFilters);
}

resetButton.addEventListener("click", () => {
  for (const input of Object.values(filters)) {
    input.value = "";
  }
  applyFilters();
  filters.search.focus();
});
"""


def write_site(exercises: list[Exercise], output_dir: Path) -> None:
    if output_dir == ROOT:
        raise ValueError("La cartella di output non puo coincidere con la root del repository")

    if output_dir.exists():
        shutil.rmtree(output_dir)

    (output_dir / "assets").mkdir(parents=True)
    (output_dir / "data").mkdir()
    (output_dir / "sorgenti").mkdir()

    (output_dir / ".nojekyll").write_text("", encoding="utf-8")
    (output_dir / "assets" / "style.css").write_text(STYLE_CSS.strip() + "\n", encoding="utf-8")
    (output_dir / "assets" / "app.js").write_text(APP_JS.strip() + "\n", encoding="utf-8")
    (output_dir / "index.html").write_text(render_index(exercises), encoding="utf-8")
    (output_dir / "data" / "esercizi.json").write_text(
        json.dumps([exercise_to_json(exercise) for exercise in exercises], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    shutil.copyfile(INDEX_CSV, output_dir / "data" / "indice_esercizi.csv")

    for exercise in exercises:
        exercise_dir = output_dir / exercise.url
        exercise_dir.mkdir(parents=True)
        (exercise_dir / "index.html").write_text(render_exercise_page(exercise), encoding="utf-8")

        source_path = ROOT / exercise.path
        source_dest = output_dir / exercise.source_url
        source_dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_path, source_dest)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Cartella di output del sito statico (default: _site)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = args.output
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir

    exercises = read_exercises()
    write_site(exercises, output_dir.resolve())
    print(f"Sito generato: {output_dir.relative_to(ROOT)}")
    print(f"Esercizi pubblicati: {len(exercises)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
