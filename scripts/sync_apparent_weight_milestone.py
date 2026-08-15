from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, before: str, after: str, label: str) -> str:
    if before not in text:
        raise SystemExit(f"replacement non trovato ({label}): {before[:100]}")
    return text.replace(before, after, 1)


def update_coverage() -> None:
    path = ROOT / "metadata" / "simulation_coverage.csv"
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "FIS-FLU-ARC-002,planned,fluid_statics,buoyancy_apparent_weight,P0,",
        "FIS-FLU-ARC-002,implemented,fluid_statics,buoyancy_apparent_weight,P0,",
        "coverage ARC-002",
    )
    path.write_text(text, encoding="utf-8")


def update_roadmap() -> None:
    path = ROOT / "docs" / "SIMULATION_ROADMAP.md"
    text = path.read_text(encoding="utf-8")
    replacements = [
        ("| `implemented` | 9 |", "| `implemented` | 10 |", "implemented count"),
        ("| `planned` | 40 |", "| `planned` | 39 |", "planned count"),
        (
            "- `fluid_statics` — 4 esercizi, modelli `hydrostatic_column` e `floating_body`.",
            "- `fluid_statics` — 5 esercizi, modelli `hydrostatic_column`, `floating_body` e `buoyancy_apparent_weight`.",
            "fluid engine count",
        ),
        (
            "## Backlog ordinato dopo `floating_body`",
            "## Backlog ordinato dopo `buoyancy_apparent_weight`",
            "backlog heading",
        ),
        (
            "| 1 | `fluid_statics` | estensione engine attivo | 5 | 5 | 3 | 8.33 | Peso apparente, Pascal, punti a diversa profondità, vasi comunicanti, getti |",
            "| 1 | `fluid_statics` | estensione engine attivo | 4 | 5 | 3 | 6.67 | Pascal, punti a diversa profondità, vasi comunicanti, getti |",
            "backlog row",
        ),
        (
            "Con il secondo modello, il manifest di `fluid_statics` usa varianti `oneOf`",
            "Con più modelli, il manifest di `fluid_statics` usa varianti `oneOf`",
            "multi-model wording",
        ),
        (
            "1. **`buoyancy_apparent_weight`** — `FIS-FLU-ARC-002`;\n"
            "2. `hydrostatic_pressure_points` — `FIS-FLU-PID-003`;\n"
            "3. `hydraulic_press` — `FIS-FLU-PAS-001`;\n"
            "4. `communicating_vessels` — `FIS-FLU-VAS-001`;\n"
            "5. `orifice_outflow` — `FIS-FLU-PID-004`, mantenuto separato dalla parte strettamente idrostatica perché introduce il moto del fluido.\n\n"
            "Il prossimo modello da implementare è **`buoyancy_apparent_weight`**: è ancora un caso di Archimede, quindi può riusare parte del linguaggio visuale appena stabilizzato, ma aggiunge un bilancio di forze con peso apparente e grandezze assolute fornite dal problema.",
            "1. **`hydrostatic_pressure_points`** — `FIS-FLU-PID-003`;\n"
            "2. `hydraulic_press` — `FIS-FLU-PAS-001`;\n"
            "3. `communicating_vessels` — `FIS-FLU-VAS-001`;\n"
            "4. `orifice_outflow` — `FIS-FLU-PID-004`, mantenuto separato dalla parte strettamente idrostatica perché introduce il moto del fluido.\n\n"
            "Il prossimo modello da implementare è **`hydrostatic_pressure_points`**: riusa la legge di Stevino già validata ma introduce punti mobili nello stesso fluido, preparando il passaggio dai confronti tra colonne alla lettura locale della pressione.",
            "next fluid models",
        ),
    ]
    for before, after, label in replacements:
        text = replace_once(text, before, after, label)

    marker = "Non vengono inventati massa o volume assoluti quando l'esercizio non li fornisce.\n\n"
    addition = (
        "### `buoyancy_apparent_weight`\n\n"
        "Copre `FIS-FLU-ARC-002`. Il testo dell'esercizio rende ora espliciti `ρ_mare=1030 kg/m³` e `g=9,8 m/s²`, così dati e soluzione sono autosufficienti. Il modello usa le due letture del dinamometro per ricavare\n\n"
        "```text\n"
        "F_A = P - P_app\n"
        "V = F_A / (ρ_f g)\n"
        "m = P / g\n"
        "ρ_c = m / V\n"
        "```\n\n"
        "e riusa internamente `floating_body` per descrivere la crescita della spinta con la frazione di volume immerso. La vista aggiunge il terzo vettore di forza, la tensione del dinamometro, e mantiene in ogni stato il bilancio quasi-statico `T + F_A = P`.\n\n"
    )
    text = replace_once(text, marker, marker + addition, "apparent weight section")
    path.write_text(text, encoding="utf-8")


def update_validate_workflow() -> None:
    path = ROOT / ".github" / "workflows" / "validate.yml"
    text = path.read_text(encoding="utf-8")

    if "apparent-weight-dom.html" not in text:
        marker = "          grep -q 'data-status=\"PASS\"' browser-artifacts/fluid-statics-mobile-dom.html\n"
        smoke = """

          google-chrome \\
            --headless=new \\
            --no-sandbox \\
            --disable-gpu \\
            --virtual-time-budget=7000 \\
            --dump-dom \\
            http://127.0.0.1:8765/tests/browser/apparent_weight_smoke.html \\
            > browser-artifacts/apparent-weight-dom.html

          grep -q 'data-status=\"PASS\"' browser-artifacts/apparent-weight-dom.html

          google-chrome \\
            --headless=new \\
            --no-sandbox \\
            --disable-gpu \\
            --force-prefers-reduced-motion \\
            --virtual-time-budget=7000 \\
            --dump-dom \\
            http://127.0.0.1:8765/tests/browser/apparent_weight_smoke.html \\
            > browser-artifacts/apparent-weight-reduced-motion-dom.html

          grep -q 'data-status=\"PASS\"' browser-artifacts/apparent-weight-reduced-motion-dom.html

          google-chrome \\
            --headless=new \\
            --no-sandbox \\
            --disable-gpu \\
            --window-size=430,3000 \\
            --virtual-time-budget=7000 \\
            --dump-dom \\
            http://127.0.0.1:8765/tests/browser/apparent_weight_smoke.html \\
            > browser-artifacts/apparent-weight-mobile-dom.html

          grep -q 'data-status=\"PASS\"' browser-artifacts/apparent-weight-mobile-dom.html
"""
        text = replace_once(text, marker, marker + smoke, "apparent browser smoke")

    if "apparent-weight-desktop.png" not in text:
        marker = "      - name: Upload simulation browser artifacts\n"
        screenshots = """          google-chrome \\
            --headless=new \\
            --no-sandbox \\
            --disable-gpu \\
            --hide-scrollbars \\
            --virtual-time-budget=2500 \\
            --window-size=1440,2400 \\
            --screenshot=browser-artifacts/apparent-weight-desktop.png \\
            http://127.0.0.1:8765/_site/esercizi/fis-flu-arc-002/

          google-chrome \\
            --headless=new \\
            --no-sandbox \\
            --disable-gpu \\
            --hide-scrollbars \\
            --virtual-time-budget=2500 \\
            --window-size=430,3000 \\
            --screenshot=browser-artifacts/apparent-weight-mobile.png \\
            http://127.0.0.1:8765/_site/esercizi/fis-flu-arc-002/

"""
        text = replace_once(text, marker, screenshots + marker, "apparent screenshots")

    path.write_text(text, encoding="utf-8")


def main() -> None:
    update_coverage()
    update_roadmap()
    update_validate_workflow()


if __name__ == "__main__":
    main()
