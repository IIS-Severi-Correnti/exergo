from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from scripts import genera_sito


PILOT_ID = "FIS-ROT-ANG-001"
REUSE_ID = "FIS-ROT-ANG-002"
GAS_PILOT_ID = "FIS-TER-GAS-003"
GAS_REUSE_ID = "FIS-TER-GAS-006"
COLLISION_PILOT_ID = "FIS-URT-COM-001"
FLUID_HYDRO_PILOT_ID = "FIS-FLU-PID-001"
FLUID_HYDRO_REUSE_ID = "FIS-FLU-PID-002"
FLUID_FLOATING_PILOT_ID = "FIS-FLU-ARC-001"
FLUID_FLOATING_REUSE_ID = "FIS-FLU-ARC-003"
FLUID_APPARENT_WEIGHT_ID = "FIS-FLU-ARC-002"
FLUID_PRESSURE_POINTS_ID = "FIS-FLU-PID-003"
FLUID_HYDRAULIC_PRESS_ID = "FIS-FLU-PAS-001"


class StaticSiteGenerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.exercises = genera_sito.read_exercises()
        cls.pilot = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == PILOT_ID
        )
        cls.reuse = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == REUSE_ID
        )
        cls.gas_pilot = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == GAS_PILOT_ID
        )
        cls.gas_reuse = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == GAS_REUSE_ID
        )
        cls.collision_pilot = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == COLLISION_PILOT_ID
        )
        cls.fluid_hydro_pilot = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_HYDRO_PILOT_ID
        )
        cls.fluid_hydro_reuse = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_HYDRO_REUSE_ID
        )
        cls.fluid_floating_pilot = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_FLOATING_PILOT_ID
        )
        cls.fluid_floating_reuse = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_FLOATING_REUSE_ID
        )
        cls.fluid_apparent_weight = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_APPARENT_WEIGHT_ID
        )
        cls.fluid_pressure_points = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_PRESSURE_POINTS_ID
        )
        cls.fluid_hydraulic_press = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_HYDRAULIC_PRESS_ID
        )
        cls.normal = next(
            exercise
            for exercise in cls.exercises
            if exercise.simulation_config is None
        )

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
                self.assertLess(
                    page.index(">Simulazione</h2>"),
                    page.index("<summary>Soluzione</summary>"),
                )

    def test_gas_exercises_reuse_second_engine_before_solution(self) -> None:
        for exercise in (self.gas_pilot, self.gas_reuse):
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="ideal_gas_process"', page)
                self.assertIn("runtime.js", page)
                self.assertIn("simulation.css", page)
                self.assertIn("engines/ideal_gas_process/style.css", page)
                self.assertLess(
                    page.index(">Simulazione</h2>"),
                    page.index("<summary>Soluzione</summary>"),
                )

    def test_collision_exercise_uses_third_engine_before_solution(self) -> None:
        page = genera_sito.render_exercise_page(self.collision_pilot)
        self.assertIn('data-simulation-engine="one_dimensional_collision"', page)
        self.assertIn("runtime.js", page)
        self.assertIn("simulation.css", page)
        self.assertIn("engines/one_dimensional_collision/style.css", page)
        self.assertLess(
            page.index(">Simulazione</h2>"),
            page.index("<summary>Soluzione</summary>"),
        )

    def test_fluid_exercises_share_one_engine_across_five_models(self) -> None:
        exercises = (
            self.fluid_hydro_pilot,
            self.fluid_hydro_reuse,
            self.fluid_floating_pilot,
            self.fluid_floating_reuse,
            self.fluid_apparent_weight,
            self.fluid_pressure_points,
            self.fluid_hydraulic_press,
        )
        for exercise in exercises:
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="fluid_statics"', page)
                self.assertIn("runtime.js", page)
                self.assertIn("simulation.css", page)
                self.assertIn("engines/fluid_statics/style.css", page)
                self.assertLess(
                    page.index(">Simulazione</h2>"),
                    page.index("<summary>Soluzione</summary>"),
                )

    def test_site_contains_four_engines_and_twelve_configs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site(self.exercises, output)

            expected_assets = {
                "core/runtime.js",
                "core/controls.js",
                "core/registry.js",
                "core/simulation.css",
                "engines/rotational_platform/engine.js",
                "engines/rotational_platform/view.js",
                "engines/rotational_platform/style.css",
                "engines/ideal_gas_process/engine.js",
                "engines/ideal_gas_process/view.js",
                "engines/ideal_gas_process/style.css",
                "engines/one_dimensional_collision/engine.js",
                "engines/one_dimensional_collision/view.js",
                "engines/one_dimensional_collision/style.css",
                "engines/fluid_statics/multi_engine.js",
                "engines/fluid_statics/engine.js",
                "engines/fluid_statics/apparent_weight_engine.js",
                "engines/fluid_statics/multi_view.js",
                "engines/fluid_statics/view.js",
                "engines/fluid_statics/floating_view.js",
                "engines/fluid_statics/apparent_weight_view.js",
                "engines/fluid_statics/pressure_points_view.js",
                "engines/fluid_statics/hydraulic_press_view.js",
                "engines/fluid_statics/style.css",
                f"config/{PILOT_ID}.json",
                f"config/{REUSE_ID}.json",
                f"config/{GAS_PILOT_ID}.json",
                f"config/{GAS_REUSE_ID}.json",
                f"config/{COLLISION_PILOT_ID}.json",
                f"config/{FLUID_HYDRO_PILOT_ID}.json",
                f"config/{FLUID_HYDRO_REUSE_ID}.json",
                f"config/{FLUID_FLOATING_PILOT_ID}.json",
                f"config/{FLUID_FLOATING_REUSE_ID}.json",
                f"config/{FLUID_APPARENT_WEIGHT_ID}.json",
                f"config/{FLUID_PRESSURE_POINTS_ID}.json",
                f"config/{FLUID_HYDRAULIC_PRESS_ID}.json",
            }
            asset_root = output / "assets" / "simulazioni"
            actual_assets = {
                path.relative_to(asset_root).as_posix()
                for path in asset_root.rglob("*")
                if path.is_file()
            }
            self.assertEqual(actual_assets, expected_assets)
            self.assertTrue((output / "index.html").is_file())
            for exercise_id in (
                PILOT_ID,
                REUSE_ID,
                GAS_PILOT_ID,
                GAS_REUSE_ID,
                COLLISION_PILOT_ID,
                FLUID_HYDRO_PILOT_ID,
                FLUID_HYDRO_REUSE_ID,
                FLUID_FLOATING_PILOT_ID,
                FLUID_FLOATING_REUSE_ID,
                FLUID_APPARENT_WEIGHT_ID,
                FLUID_PRESSURE_POINTS_ID,
                FLUID_HYDRAULIC_PRESS_ID,
            ):
                with self.subTest(exercise=exercise_id):
                    self.assertTrue(
                        (
                            output
                            / "esercizi"
                            / exercise_id.casefold()
                            / "index.html"
                        ).is_file()
                    )

    def test_gas_subset_copies_only_ideal_gas_engine(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site([self.gas_pilot, self.gas_reuse], output)

            asset_root = output / "assets" / "simulazioni"
            actual_assets = {
                path.relative_to(asset_root).as_posix()
                for path in asset_root.rglob("*")
                if path.is_file()
            }
            self.assertIn("engines/ideal_gas_process/engine.js", actual_assets)
            self.assertIn("engines/ideal_gas_process/view.js", actual_assets)
            self.assertIn("engines/ideal_gas_process/style.css", actual_assets)
            self.assertIn(f"config/{GAS_PILOT_ID}.json", actual_assets)
            self.assertIn(f"config/{GAS_REUSE_ID}.json", actual_assets)
            self.assertFalse(
                any(path.startswith("engines/rotational_platform/") for path in actual_assets)
            )
            self.assertFalse(
                any(path.startswith("engines/one_dimensional_collision/") for path in actual_assets)
            )
            self.assertFalse(
                any(path.startswith("engines/fluid_statics/") for path in actual_assets)
            )

    def test_collision_subset_copies_only_collision_engine(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site([self.collision_pilot], output)

            asset_root = output / "assets" / "simulazioni"
            actual_assets = {
                path.relative_to(asset_root).as_posix()
                for path in asset_root.rglob("*")
                if path.is_file()
            }
            self.assertIn("engines/one_dimensional_collision/engine.js", actual_assets)
            self.assertIn("engines/one_dimensional_collision/view.js", actual_assets)
            self.assertIn("engines/one_dimensional_collision/style.css", actual_assets)
            self.assertIn(f"config/{COLLISION_PILOT_ID}.json", actual_assets)
            self.assertFalse(
                any(path.startswith("engines/rotational_platform/") for path in actual_assets)
            )
            self.assertFalse(
                any(path.startswith("engines/ideal_gas_process/") for path in actual_assets)
            )
            self.assertFalse(
                any(path.startswith("engines/fluid_statics/") for path in actual_assets)
            )

    def test_fluid_subset_copies_one_engine_and_five_models(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            fluid_exercises = [
                self.fluid_hydro_pilot,
                self.fluid_hydro_reuse,
                self.fluid_floating_pilot,
                self.fluid_floating_reuse,
                self.fluid_apparent_weight,
                self.fluid_pressure_points,
                self.fluid_hydraulic_press,
            ]
            genera_sito.write_site(fluid_exercises, output)

            asset_root = output / "assets" / "simulazioni"
            actual_assets = {
                path.relative_to(asset_root).as_posix()
                for path in asset_root.rglob("*")
                if path.is_file()
            }
            for asset in (
                "engines/fluid_statics/multi_engine.js",
                "engines/fluid_statics/engine.js",
                "engines/fluid_statics/apparent_weight_engine.js",
                "engines/fluid_statics/multi_view.js",
                "engines/fluid_statics/view.js",
                "engines/fluid_statics/floating_view.js",
                "engines/fluid_statics/apparent_weight_view.js",
                "engines/fluid_statics/pressure_points_view.js",
                "engines/fluid_statics/hydraulic_press_view.js",
                "engines/fluid_statics/style.css",
            ):
                self.assertIn(asset, actual_assets)
            for exercise_id in (
                FLUID_HYDRO_PILOT_ID,
                FLUID_HYDRO_REUSE_ID,
                FLUID_FLOATING_PILOT_ID,
                FLUID_FLOATING_REUSE_ID,
                FLUID_APPARENT_WEIGHT_ID,
                FLUID_PRESSURE_POINTS_ID,
                FLUID_HYDRAULIC_PRESS_ID,
            ):
                self.assertIn(f"config/{exercise_id}.json", actual_assets)
            self.assertFalse(
                any(path.startswith("engines/rotational_platform/") for path in actual_assets)
            )
            self.assertFalse(
                any(path.startswith("engines/ideal_gas_process/") for path in actual_assets)
            )
            self.assertFalse(
                any(path.startswith("engines/one_dimensional_collision/") for path in actual_assets)
            )


if __name__ == "__main__":
    unittest.main()
