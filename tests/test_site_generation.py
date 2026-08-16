from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from scripts import genera_sito


PILOT_ID = "FIS-ROT-ANG-001"
REUSE_ID = "FIS-ROT-ANG-002"
GAS_PILOT_ID = "FIS-TER-GAS-003"
GAS_REUSE_ID = "FIS-TER-GAS-006"
GAS_EXPANSION_IDS = (
    "FIS-TER-GAS-001",
    "FIS-TER-GAS-002",
    "FIS-TER-GAS-004",
    "FIS-TER-GAS-005",
)
ALL_GAS_IDS = (GAS_PILOT_ID, GAS_REUSE_ID, *GAS_EXPANSION_IDS)
COLLISION_PILOT_ID = "FIS-URT-COM-001"
FLUID_HYDRO_PILOT_ID = "FIS-FLU-PID-001"
FLUID_HYDRO_REUSE_ID = "FIS-FLU-PID-002"
FLUID_FLOATING_PILOT_ID = "FIS-FLU-ARC-001"
FLUID_FLOATING_REUSE_ID = "FIS-FLU-ARC-003"
FLUID_APPARENT_WEIGHT_ID = "FIS-FLU-ARC-002"
FLUID_PRESSURE_POINTS_ID = "FIS-FLU-PID-003"
FLUID_HYDRAULIC_PRESS_ID = "FIS-FLU-PAS-001"
FLUID_COMMUNICATING_VESSELS_ID = "FIS-FLU-VAS-001"
DC_EXPANSION_IDS = (
    "FIS-CIR-BAS-001",
    "FIS-CIR-COR-001",
    "FIS-CIR-OHM-001",
    "FIS-CIR-OHM-002",
    "FIS-CIR-RES-001",
)
CALORIMETRY_EXPANSION_IDS = (
    "FIS-TER-CAL-001",
    "FIS-TER-CAL-002",
    "FIS-TER-EQ-001",
    "FIS-TER-EQ-002",
    "FIS-TER-PAS-001",
)
OPTICS_IDS = (
    "FIS-OTT-RFL-001",
    "FIS-OTT-RIF-001",
    "FIS-OTT-RIF-002",
    "FIS-OTT-RIF-003",
    "FIS-OTT-SPE-001",
)
WAVE_IDS = (
    "FIS-OND-DOP-001",
    "FIS-OND-DOP-002",
    "FIS-OND-COR-001",
    "FIS-OND-MEC-001",
    "FIS-OND-SUO-001",
)


class StaticSiteGenerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.exercises = genera_sito.read_exercises()
        by_id = {exercise.exercise_id: exercise for exercise in cls.exercises}
        cls.pilot = by_id[PILOT_ID]
        cls.reuse = by_id[REUSE_ID]
        cls.gas_exercises = tuple(by_id[exercise_id] for exercise_id in ALL_GAS_IDS)
        cls.collision_pilot = by_id[COLLISION_PILOT_ID]
        cls.fluid_hydro_pilot = by_id[FLUID_HYDRO_PILOT_ID]
        cls.fluid_hydro_reuse = by_id[FLUID_HYDRO_REUSE_ID]
        cls.fluid_floating_pilot = by_id[FLUID_FLOATING_PILOT_ID]
        cls.fluid_floating_reuse = by_id[FLUID_FLOATING_REUSE_ID]
        cls.fluid_apparent_weight = by_id[FLUID_APPARENT_WEIGHT_ID]
        cls.fluid_pressure_points = by_id[FLUID_PRESSURE_POINTS_ID]
        cls.fluid_hydraulic_press = by_id[FLUID_HYDRAULIC_PRESS_ID]
        cls.fluid_communicating_vessels = by_id[FLUID_COMMUNICATING_VESSELS_ID]
        cls.dc_exercises = tuple(by_id[exercise_id] for exercise_id in DC_EXPANSION_IDS)
        cls.calorimetry_exercises = tuple(by_id[exercise_id] for exercise_id in CALORIMETRY_EXPANSION_IDS)
        cls.optics_exercises = tuple(by_id[exercise_id] for exercise_id in OPTICS_IDS)
        cls.wave_exercises = tuple(by_id[exercise_id] for exercise_id in WAVE_IDS)
        cls.normal = next(exercise for exercise in cls.exercises if exercise.simulation_config is None)

    def test_normal_exercise_does_not_load_simulation_assets(self) -> None:
        page = genera_sito.render_exercise_page(self.normal)
        self.assertNotIn("data-exergo-simulation", page)
        self.assertNotIn("runtime.js", page)
        self.assertNotIn("simulation.css", page)
        self.assertIn("<summary>Soluzione</summary>", page)

    def test_rotational_exercises_use_same_engine_before_solution(self) -> None:
        for exercise in (self.pilot, self.reuse):
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="rotational_platform"', page)
                self.assertIn("runtime.js", page)
                self.assertIn("simulation.css", page)
                self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_all_six_gas_exercises_share_one_engine_across_five_models(self) -> None:
        for exercise in self.gas_exercises:
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="ideal_gas_process"', page)
                self.assertIn("engines/ideal_gas_process/style.css", page)
                self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_collision_exercise_uses_third_engine_before_solution(self) -> None:
        page = genera_sito.render_exercise_page(self.collision_pilot)
        self.assertIn('data-simulation-engine="one_dimensional_collision"', page)
        self.assertIn("engines/one_dimensional_collision/style.css", page)
        self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_fluid_exercises_share_one_engine_across_six_models(self) -> None:
        exercises = (
            self.fluid_hydro_pilot,
            self.fluid_hydro_reuse,
            self.fluid_floating_pilot,
            self.fluid_floating_reuse,
            self.fluid_apparent_weight,
            self.fluid_pressure_points,
            self.fluid_hydraulic_press,
            self.fluid_communicating_vessels,
        )
        for exercise in exercises:
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="fluid_statics"', page)
                self.assertIn("engines/fluid_statics/style.css", page)
                self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_dc_exercises_share_one_engine_across_three_models(self) -> None:
        for exercise in self.dc_exercises:
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="dc_circuit"', page)
                self.assertIn("engines/dc_circuit/style.css", page)
                self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_calorimetry_exercises_share_one_engine_across_five_models(self) -> None:
        for exercise in self.calorimetry_exercises:
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="calorimetry"', page)
                self.assertIn("engines/calorimetry/style.css", page)
                self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_all_five_optics_exercises_share_ray_optics_engine(self) -> None:
        for exercise in self.optics_exercises:
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="ray_optics"', page)
                self.assertIn("engines/ray_optics/style.css", page)
                self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_all_five_wave_exercises_share_wave_engine(self) -> None:
        for exercise in self.wave_exercises:
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="wave_1d"', page)
                self.assertIn("engines/wave_1d/style.css", page)
                self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_site_contains_eight_engines_and_thirty_seven_configs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site(self.exercises, output)
            expected_assets = {
                "core/runtime.js", "core/controls.js", "core/registry.js", "core/simulation.css",
                "engines/rotational_platform/engine.js", "engines/rotational_platform/view.js", "engines/rotational_platform/style.css",
                "engines/ideal_gas_process/engine.js", "engines/ideal_gas_process/view.js", "engines/ideal_gas_process/style.css",
                "engines/one_dimensional_collision/engine.js", "engines/one_dimensional_collision/view.js", "engines/one_dimensional_collision/style.css",
                "engines/fluid_statics/multi_engine.js", "engines/fluid_statics/engine.js", "engines/fluid_statics/apparent_weight_engine.js",
                "engines/fluid_statics/multi_view.js", "engines/fluid_statics/view.js", "engines/fluid_statics/floating_view.js",
                "engines/fluid_statics/apparent_weight_view.js", "engines/fluid_statics/pressure_points_view.js",
                "engines/fluid_statics/hydraulic_press_view.js", "engines/fluid_statics/communicating_vessels_view.js", "engines/fluid_statics/style.css",
                "engines/dc_circuit/engine.js", "engines/dc_circuit/view.js", "engines/dc_circuit/style.css",
                "engines/calorimetry/engine.js", "engines/calorimetry/view.js", "engines/calorimetry/style.css",
                "engines/ray_optics/engine.js", "engines/ray_optics/view.js", "engines/ray_optics/style.css",
                "engines/wave_1d/engine.js", "engines/wave_1d/view.js", "engines/wave_1d/style.css",
            }
            simulated_ids = (
                PILOT_ID, REUSE_ID, *ALL_GAS_IDS, COLLISION_PILOT_ID,
                FLUID_HYDRO_PILOT_ID, FLUID_HYDRO_REUSE_ID, FLUID_FLOATING_PILOT_ID,
                FLUID_FLOATING_REUSE_ID, FLUID_APPARENT_WEIGHT_ID, FLUID_PRESSURE_POINTS_ID,
                FLUID_HYDRAULIC_PRESS_ID, FLUID_COMMUNICATING_VESSELS_ID,
                *DC_EXPANSION_IDS, *CALORIMETRY_EXPANSION_IDS, *OPTICS_IDS, *WAVE_IDS,
            )
            for exercise_id in simulated_ids:
                expected_assets.add(f"config/{exercise_id}.json")
            asset_root = output / "assets" / "simulazioni"
            actual_assets = {path.relative_to(asset_root).as_posix() for path in asset_root.rglob("*") if path.is_file()}
            self.assertEqual(actual_assets, expected_assets)
            self.assertTrue((output / "index.html").is_file())
            for exercise_id in simulated_ids:
                with self.subTest(exercise=exercise_id):
                    self.assertTrue((output / "esercizi" / exercise_id.casefold() / "index.html").is_file())

    def _asset_set(self, exercises) -> set[str]:
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        output = Path(temporary_directory.name) / "site"
        genera_sito.write_site(exercises, output)
        asset_root = output / "assets" / "simulazioni"
        return {path.relative_to(asset_root).as_posix() for path in asset_root.rglob("*") if path.is_file()}

    def test_gas_subset_copies_only_ideal_gas_engine_and_all_six_configs(self) -> None:
        actual_assets = self._asset_set(self.gas_exercises)
        for asset in ("engines/ideal_gas_process/engine.js", "engines/ideal_gas_process/view.js", "engines/ideal_gas_process/style.css"):
            self.assertIn(asset, actual_assets)
        for exercise_id in ALL_GAS_IDS:
            self.assertIn(f"config/{exercise_id}.json", actual_assets)
        self.assertFalse(any(path.startswith("engines/dc_circuit/") for path in actual_assets))
        self.assertFalse(any(path.startswith("engines/calorimetry/") for path in actual_assets))
        self.assertFalse(any(path.startswith("engines/fluid_statics/") for path in actual_assets))
        self.assertFalse(any(path.startswith("engines/ray_optics/") for path in actual_assets))
        self.assertFalse(any(path.startswith("engines/wave_1d/") for path in actual_assets))

    def test_collision_subset_copies_only_collision_engine(self) -> None:
        actual_assets = self._asset_set([self.collision_pilot])
        self.assertIn("engines/one_dimensional_collision/engine.js", actual_assets)
        self.assertIn(f"config/{COLLISION_PILOT_ID}.json", actual_assets)
        self.assertFalse(any(path.startswith("engines/ray_optics/") for path in actual_assets))
        self.assertFalse(any(path.startswith("engines/wave_1d/") for path in actual_assets))

    def test_fluid_subset_copies_one_engine_and_six_models(self) -> None:
        actual_assets = self._asset_set([
            self.fluid_hydro_pilot, self.fluid_hydro_reuse, self.fluid_floating_pilot,
            self.fluid_floating_reuse, self.fluid_apparent_weight, self.fluid_pressure_points,
            self.fluid_hydraulic_press, self.fluid_communicating_vessels,
        ])
        self.assertIn("engines/fluid_statics/multi_engine.js", actual_assets)
        self.assertIn("engines/fluid_statics/communicating_vessels_view.js", actual_assets)
        self.assertFalse(any(path.startswith("engines/ray_optics/") for path in actual_assets))
        self.assertFalse(any(path.startswith("engines/wave_1d/") for path in actual_assets))

    def test_dc_subset_is_self_contained(self) -> None:
        actual_assets = self._asset_set(self.dc_exercises)
        for asset in ("engines/dc_circuit/engine.js", "engines/dc_circuit/view.js", "engines/dc_circuit/style.css"):
            self.assertIn(asset, actual_assets)
        for exercise_id in DC_EXPANSION_IDS:
            self.assertIn(f"config/{exercise_id}.json", actual_assets)
        self.assertFalse(any(path.startswith("engines/ray_optics/") for path in actual_assets))
        self.assertFalse(any(path.startswith("engines/wave_1d/") for path in actual_assets))

    def test_calorimetry_subset_is_self_contained(self) -> None:
        actual_assets = self._asset_set(self.calorimetry_exercises)
        for asset in ("engines/calorimetry/engine.js", "engines/calorimetry/view.js", "engines/calorimetry/style.css"):
            self.assertIn(asset, actual_assets)
        for exercise_id in CALORIMETRY_EXPANSION_IDS:
            self.assertIn(f"config/{exercise_id}.json", actual_assets)
        self.assertFalse(any(path.startswith("engines/ray_optics/") for path in actual_assets))
        self.assertFalse(any(path.startswith("engines/wave_1d/") for path in actual_assets))

    def test_ray_optics_subset_is_self_contained(self) -> None:
        actual_assets = self._asset_set(self.optics_exercises)
        for asset in ("engines/ray_optics/engine.js", "engines/ray_optics/view.js", "engines/ray_optics/style.css"):
            self.assertIn(asset, actual_assets)
        for exercise_id in OPTICS_IDS:
            self.assertIn(f"config/{exercise_id}.json", actual_assets)
        for other_engine in ("ideal_gas_process", "fluid_statics", "dc_circuit", "calorimetry", "rotational_platform", "one_dimensional_collision", "wave_1d"):
            self.assertFalse(any(path.startswith(f"engines/{other_engine}/") for path in actual_assets))

    def test_wave_subset_is_self_contained(self) -> None:
        actual_assets = self._asset_set(self.wave_exercises)
        for asset in ("engines/wave_1d/engine.js", "engines/wave_1d/view.js", "engines/wave_1d/style.css"):
            self.assertIn(asset, actual_assets)
        for exercise_id in WAVE_IDS:
            self.assertIn(f"config/{exercise_id}.json", actual_assets)
        for other_engine in ("ideal_gas_process", "fluid_statics", "dc_circuit", "calorimetry", "rotational_platform", "one_dimensional_collision", "ray_optics"):
            self.assertFalse(any(path.startswith(f"engines/{other_engine}/") for path in actual_assets))


if __name__ == "__main__":
    unittest.main()
