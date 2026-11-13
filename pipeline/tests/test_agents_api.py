"""The API runner's pure parts: no network, no key needed."""

import unittest

from pipeline.agents_api import cost, drafts_from_response, group_claims, render, verdicts_from_response


class Shapes(unittest.TestCase):
    def test_verdicts_become_the_file_shape(self):
        data = {"claims": [
            {"id": "Na.uses.0", "verdict": "supported", "excerpt": "used in streetlights", "reason": ""},
            {"id": "Na.story.1", "verdict": "not_supported", "excerpt": "", "reason": "not in the passage"},
        ]}
        self.assertEqual(verdicts_from_response(data), {
            "Na.uses.0": {"verdict": "supported", "excerpt": "used in streetlights"},
            "Na.story.1": {"verdict": "not_supported", "reason": "not in the passage"},
        })

    def test_drafts_become_the_file_shape(self):
        s = {"text": "t", "passage": "p", "excerpt": "e"}
        data = {"elements": [
            {"symbol": "Na", "discoveryYear": {"kind": "year", "year": 1807, "passage": "p", "excerpt": "in 1807"}, "story": [s], "uses": []},
            {"symbol": "Au", "discoveryYear": {"kind": "ancient", "year": 0, "passage": "p", "excerpt": "ancient"}, "story": [], "uses": [s]},
            {"symbol": "H", "discoveryYear": {"kind": "none", "year": 0, "passage": "", "excerpt": ""}, "story": [], "uses": []},
        ]}
        out = drafts_from_response(data)
        self.assertEqual(out["Na"]["discoveryYear"]["value"], 1807)
        self.assertEqual(out["Au"]["discoveryYear"]["value"], "Ancient")
        self.assertIsNone(out["H"]["discoveryYear"])

    def test_one_group_per_element_plus_explanations(self):
        claims = [{"id": "Na.uses.0"}, {"id": "Na.story.0"}, {"id": "Cl.uses.0"}, {"id": "concept.shells"}]
        self.assertEqual({k: len(v) for k, v in group_claims(claims).items()}, {"Na": 2, "Cl": 1, "concept": 1})

    def test_render_and_cost(self):
        self.assertEqual(render("Read {sources}, write {output}.", sources="A", output="B"), "Read A, write B.")
        self.assertAlmostEqual(cost({"input": 1_000_000, "output": 100_000, "cache_read": 0}), 6.0)


if __name__ == "__main__":
    unittest.main()
