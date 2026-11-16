"""Code checks around the reaction text agents: claims and evaluation, with
a fake draft and fake verdicts (no API calls, no network)."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from pipeline import reaction_text as R

PASSAGES = [
    {"id": "lt/ionic-bonds", "contributor": "LibreTexts Chemistry", "url": "https://chem.libretexts.org/x", "retrieved": "2026-11-16",
     "text": "Sodium gives up an electron to chlorine, and the two ions are held together by an ionic bond in sodium chloride."},
    {"id": "Na/Reactivity Profile/0", "contributor": "CAMEO Chemicals", "url": "https://pubchem.ncbi.nlm.nih.gov/compound/1#section=Reactivity-Profile",
     "retrieved": "2026-11-16", "text": "Reacts violently with water. Burns in chlorine with a bright flame."},
    {"id": "NaCl/Physical Description/0", "contributor": "CAMEO Chemicals", "url": "https://pubchem.ncbi.nlm.nih.gov/compound/3#section=Physical-Description",
     "retrieved": "2026-11-16", "text": "Sodium chloride is a white crystalline solid that is used to season food."},
]
TASKS = {
    "reactions": [{"id": "test-salt", "title": "Test", "kind": "reaction", "equation": "2 Na(s) + Cl2(g) -> 2 NaCl(s)",
                   "substances": [], "energy": "exothermic", "passages": ["lt/ionic-bonds", "Na/Reactivity Profile/0"]}],
    "substances": [{"key": "NaCl", "id": "compound:cid-3", "name": "Sodium Chloride", "formula": "NaCl",
                    "fields": ["standardState", "appearance", "uses"], "passages": ["NaCl/Physical Description/0"]}],
}
S = lambda text, passage, excerpt, **kw: {"text": text, "passage": passage, "excerpt": excerpt, **kw}
DRAFTS = {
    "reactions": {"test-salt": {
        "summary": [S("Sodium and chlorine make sodium chloride.", "lt/ionic-bonds", "ionic bond in sodium chloride")],
        "bondingType": [S("Sodium chloride is held together by an ionic bond.", "lt/ionic-bonds", "held together by an ionic bond", value="ionic")],
        "bondingWhy": [S("Sodium gives an electron to chlorine.", "lt/ionic-bonds", "Sodium gives up an electron to chlorine")],
        "trigger": [S("It starts when heated to 100 degrees.", "Na/Reactivity Profile/0", "Burns in chlorine")],
        "hazard": [S("Sodium burns brightly in chlorine.", "Na/Reactivity Profile/0", "Burns in chlorine with a bright flame"),
                   S("Sodium reacts violently with water.", "Na/Reactivity Profile/0", "Reacts violently with acids")],
        "whyNot": [S("Nothing happens.", "lt/ionic-bonds", "Sodium gives up")],
    }},
    "substances": {"NaCl": {
        "standardState": [S("Sodium chloride is a liquid at room temperature.", "NaCl/Physical Description/0", "white crystalline solid", value="liquid")],
        "appearance": [S("Sodium chloride is a white crystalline solid.", "NaCl/Physical Description/0", "a white crystalline solid")],
        "uses": [S("Sodium chloride is used to season food.", "NaCl/Physical Description/0", "used to season food")],
    }},
}


class ReactionText(unittest.TestCase):
    def run_steps(self, verdicts):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / "sources.json").write_text(json.dumps(PASSAGES), "utf-8")
            (d / "tasks.json").write_text(json.dumps(TASKS), "utf-8")
            run = R.ROOT / "verification" / "agent-runs" / "_test-reaction-text"
            run.mkdir(parents=True, exist_ok=True)
            try:
                (run / "drafts.json").write_text(json.dumps(DRAFTS), "utf-8")
                with mock.patch.object(R, "SOURCES_FILE", d / "sources.json"), mock.patch.object(R, "TASKS_FILE", d / "tasks.json"):
                    R.build_claims(run)
                    claims = json.loads((run / "claims.json").read_text("utf-8"))
                    rejected = {x["id"]: x["reason"] for x in json.loads((run / "rejected-before-verification.json").read_text("utf-8"))}
                    for n in range(1, R.RUNS + 1):
                        (run / f"verdicts-{n}.json").write_text(json.dumps({"claims": verdicts(n, claims)}), "utf-8")
                    R.evaluate(run)
                    facts = json.loads((run / "facts.json").read_text("utf-8"))
                    report = (run / "report.md").read_text("utf-8")
            finally:
                for f in run.iterdir():
                    f.unlink()
                run.rmdir()
        return claims, rejected, facts, report

    def test_code_checks_and_three_of_three(self):
        def verdicts(n, claims):
            out = {}
            for c in claims:
                excerpt = next(x for x in [*DRAFTS["reactions"]["test-salt"].get(c["id"].split(".")[1], []),
                                           *DRAFTS["substances"]["NaCl"].get(c["id"].split(".")[1], [])]
                               if x["text"] == c["text"])["excerpt"]
                # Verifier 3 rejects the uses statement: it must then fail.
                out[c["id"]] = ({"verdict": "not_supported", "reason": "test"} if (n == 3 and ".uses." in c["id"])
                                else {"verdict": "supported", "excerpt": excerpt})
            return out

        claims, rejected, facts, report = self.run_steps(verdicts)
        ids = {c["id"] for c in claims}
        self.assertIn("test-salt.summary.0", ids)
        self.assertIn("test-salt.bondingType.0", ids)
        self.assertIn("safety screen", rejected["test-salt.trigger.0"])          # "heated to", a number
        self.assertIn("word for word", rejected["test-salt.hazard.1"])          # excerpt not in passage
        self.assertIn("doesn't apply", rejected["test-salt.whyNot.0"])          # whyNot on a reaction
        self.assertIn("must both say", rejected["NaCl.standardState.0"])        # "liquid" not in the excerpt
        self.assertTrue(all("value" not in c or c["id"].endswith(("bondingType.0", "standardState.0")) for c in claims))

        rx = facts["reactions"]["reaction:test-salt"]
        self.assertEqual(rx["bonding"]["type"]["value"], "ionic")
        self.assertEqual(rx["bonding"]["type"]["verification"]["recordId"], "test-salt.bonding.type")
        self.assertEqual([f["value"] for f in rx["hazard"]["why"]], ["Sodium burns brightly in chlorine."])
        self.assertNotIn("trigger", rx)
        nacl = facts["substances"]["compound:cid-3"]
        self.assertEqual(nacl["uses"], [])  # 2 of 3 is a fail
        self.assertEqual(nacl["appearance"]["value"], "Sodium chloride is a white crystalline solid.")
        rec = {r["id"]: r for r in facts["records"]}
        self.assertEqual(rec["cid-3.appearance"]["consistency"], {"runs": 3, "agreeing": 3})
        self.assertIn("❌ **uses:**", report)
        self.assertIn("⛔ **trigger:**", report)

    def test_hazard_screen_allows_danger_words_but_not_how(self):
        self.assertIsNone(R.screen("hazard", "It can explode and give off a poisonous gas."))
        self.assertIsNotNone(R.screen("hazard", "Mix it with water to see it explode."))
        self.assertIsNone(R.screen("hazard", "Mixtures of hydrogen and air can explode."))
        self.assertIsNotNone(R.screen("hazard", "Add water and it bursts into flame."))
        self.assertIsNotNone(R.screen("summary", "It can explode."))  # danger belongs in the hazard note
        self.assertIsNotNone(R.screen("trigger", "A spark at 500 degrees."))


if __name__ == "__main__":
    unittest.main()
