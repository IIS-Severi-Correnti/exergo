from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
PERMANENT_WORKFLOWS = {
    "pages.yml",
    "validate-expansion-browser.yml",
    "validate.yml",
}
SEMVER_BETA_RE = re.compile(r"^\d+\.\d+\.\d+-beta(?:\.\d+)?$")


class RepositoryHygieneTests(unittest.TestCase):
    def test_only_declared_permanent_workflows_are_committed(self) -> None:
        actual = {path.name for path in WORKFLOWS.glob("*.yml")}
        self.assertEqual(PERMANENT_WORKFLOWS, actual)

    def test_workflows_do_not_write_repository_contents(self) -> None:
        for path in WORKFLOWS.glob("*.yml"):
            with self.subTest(workflow=path.name):
                text = path.read_text(encoding="utf-8")
                self.assertNotIn("contents: write", text)

    def test_version_uses_beta_semver(self) -> None:
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        self.assertRegex(version, SEMVER_BETA_RE)


if __name__ == "__main__":
    unittest.main()
