---
agent_name: pagoclaro
version: 1
status: draft            # draft | approved — approved only by the owner at the gate
date: 2026-10-17
track: heavy
design_version: 1
spec_version: 1
evals_date: 2026-10-17
stack: no-framework@n/a
runtime: <language, framework and model route>
target: <deployment target>
results: <path of the green run under runs/, such as runs/NAME.json>
---

# PagoClaro — Build record

## 1. Runtime and target

Build what the spec and the design fix (the target and model seam in the design, the stack and
the tool contracts in the spec). What they leave open (language and framework when the spec pins
no stack, a light agent's target) the owner chooses, recorded in Pinned by as an assumption.
Changing what they do fix is a re-entry.

- **Runtime:** <language, framework and model route>
- **Stack binding:** <the binding followed, catalog/bindings/ and the card id, and each of its
  spikes run, with its result — or "not applicable:" and why, when the spec pins no stack or one
  off the catalog>
- **Model capabilities:** <tool calling native or prompted (and the parser); reasoning off, native
  (budget) or prompted; samples per turn; context window; the probe that confirmed it — or
  "not applicable:" and why, when no model is in the route>
- **MCP servers:** <none, or name@version for each server the tools come through, with the date
  its tool descriptions were reviewed>
- **Target:** <deployment target>
- **Pinned by:** <the sections that fix each choice, or the owner's choice as an assumption>
- **Dependencies:** <lockfile in place, and how each package was checked to exist before install>

## 2. Anti-gaming rail

The guard is installed before the first source file. It blocks edits to evals/ and to the design
and the spec; the Test column of the spec's Traceability table is the one sanctioned edit.

- **Installed:** baseline 799beb7 (design, spec y evals aprobados), luego el guard en 18f0f4c
- **Verified:** <the dummy edit tried before any source file, and the block it got>
- **Test-column edit:** <Test cells only, guard on (no rename), the diff checked, the commit>

## 3. Delegation

Forge-master takes a non-trivial build (more than 3 tools, any non-safe tier, channel
infrastructure or more than 15 cases) when it is installed; otherwise the build is direct TDD.

- **Route:** <forge or direct>
- **Reason:** <the counts and the installed state that decided the route>
- **PRD and plan:** <PRD path and plan id when forge; or —>

## 4. Runner

The runner loads evals/ as read-only data and writes one results file per run.

- **Command:** <the exact command that runs the suite and writes the results file>
- **Results file:** <path under runs/ of the run recorded in section 5>
- **Evals access:** <how the runner reads evals/ and where it writes, so it never writes there>

## 5. Suite result

Copied from the results file, not retyped from memory. One row per tier that has cases.

| Tier | Cases | Required per case | Result |
|---|---|---|---|
| <safe, reversible, destructive> | <cases> | <runs and passes needed> | <met or not met> |

- **Adversarial:** <how many adversarial cases ran and how many passed>
- **Release blockers:** <each blocker from evals/config.json and its status in this run>

## 6. Smoke test

The agent runs once end to end in its real shape, outside the eval harness.

- **Start:** <the command that starts the agent, and what it printed>
- **Health:** <the health check and its answer>
- **Round trip:** <one simulated input through the real ingress, its visible effect and log line>

## 7. Deviations and additions

Anything built that the spec does not name, and anything the spec names that was not built as
written.

- <A deviation or addition and the upstream change it calls for; or "none">
