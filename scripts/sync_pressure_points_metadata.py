from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, before: str, after: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if after in text:
        return
    if before not in text:
        raise SystemExit(f"marker non trovato ({label}): {before[:120]!r}")
    path.write_text(text.replace(before, after, 1), encoding="utf-8")


def main() -> None:
    coverage = ROOT / "metadata/simulation_coverage.csv"
    replace_once(
        coverage,
        "FIS-FLU-PID-003,planned,fluid_statics,hydrostatic_pressure_points,P1,",
        "FIS-FLU-PID-003,implemented,fluid_statics,hydrostatic_pressure_points,P1,",
        "coverage PID-003",
    )

    roadmap = ROOT / "docs/SIMULATION_ROADMAP.md"
    replacements = (
        ("| `implemented` | 10 |", "| `implemented` | 11 |", "implemented count"),
        ("| `planned` | 39 |", "| `planned` | 38 |", "planned count"),
        (
            "- `fluid_statics` — 5 esercizi, modelli `hydrostatic_column`, `floating_body` e `buoyancy_apparent_weight`.",
            "- `fluid_statics` — 6 esercizi, modelli `hydrostatic_column`, `floating_body`, `buoyancy_apparent_weight` e `hydrostatic_pressure_points`.",
            "fluid statics count",
        ),
        (
            "## Backlog ordinato dopo `buoyancy_apparent_weight`",
            "## Backlog ordinato dopo `hydrostatic_pressure_points`",
            "backlog heading",
        ),
        (
            "| 1 | `fluid_statics` | estensione engine attivo | 4 | 5 | 3 | 6.67 | Pascal, punti a diversa profondità, vasi comunicanti, getti |",
            "| 1 | `fluid_statics` | estensione engine attivo | 3 | 5 | 3 | 5.00 | Pascal, vasi comunicanti, getti |",
            "backlog fluid row",
        ),
        (
            "1. **`hydrostatic_pressure_points`** — `FIS-FLU-PID-003`;\n2. `hydraulic_press` — `FIS-FLU-PAS-001`;\n3. `communicating_vessels` — `FIS-FLU-VAS-001`;\n4. `orifice_outflow` — `FIS-FLU-PID-004`, mantenuto separato dalla parte strettamente idrostatica perché introduce il moto del fluido.\n\nIl prossimo modello da implementare è **`hydrostatic_pressure_points`**: riusa la legge di Stevino già validata ma introduce punti mobili nello stesso fluido, preparando il passaggio dai confronti tra colonne alla lettura locale della pressione.",
            "1. **`hydraulic_press`** — `FIS-FLU-PAS-001`;\n2. `communicating_vessels` — `FIS-FLU-VAS-001`;\n3. `orifice_outflow` — `FIS-FLU-PID-004`, mantenuto separato dalla parte strettamente idrostatica perché introduce il moto del fluido.\n\nIl prossimo modello da implementare è **`hydraulic_press`**: introduce la legge di Pascal e un rapporto tra aree e forze, quindi amplia `fluid_statics` senza duplicare la logica della pressione idrostatica già consolidata.",
            "next fluid model",
        ),
    )
    for before, after, label in replacements:
        replace_once(roadmap, before, after, label)

    marker = "e riusa internamente `floating_body` per descrivere la crescita della spinta con la frazione di volume immerso. La vista aggiunge il terzo vettore di forza, la tensione del dinamometro, e mantiene in ogni stato il bilancio quasi-statico `T + F_A = P`.\n\n"
    addition = """### `hydrostatic_pressure_points`\n\nCopre `FIS-FLU-PID-003` senza trasformare i valori illustrativi in dati del quesito. Il motore riusa la stessa funzione `Δp=ρgh` di `hydrostatic_column`: nello stato iniziale il punto mobile B coincide con il livello di A, quindi\n\n```text\np_A = p_B < p_C = p_D = p_E\n```\n\nDurante l'esplorazione B scende tra i due livelli e infine raggiunge C-D-E. I punti C, D ed E restano a coordinate orizzontali diverse ma alla stessa profondità, rendendo visivamente esplicito che la pressione idrostatica non dipende dalla posizione orizzontale. Le profondità metriche e i pascal mostrati dalla vista sono dichiarati come **scala didattica**, non come dati originali dell'esercizio.\n\n"""
    text = roadmap.read_text(encoding="utf-8")
    if "### `hydrostatic_pressure_points`" not in text:
        if marker not in text:
            raise SystemExit("marker sezione pressure points non trovato")
        roadmap.write_text(text.replace(marker, marker + addition, 1), encoding="utf-8")


if __name__ == "__main__":
    main()
