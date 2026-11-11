# pipeline

The build-time content pipeline (spec 6). It's written in Python and contains
the orchestrator, drafting agent, verifier agents, evaluator, and their prompts.
It writes JSON that validates against [../data/schema/](../data/schema/).

Phases 1 to 3 verify with Claude Code subagents. Before anything is published,
this pipeline moves to the Claude API, so anyone can re-run verification from
the public repo.

Empty until phase 2.
