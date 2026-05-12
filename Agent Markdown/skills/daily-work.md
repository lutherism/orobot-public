---
name: daily-work
description: A loopable orchestrator that finds something to do and does it. Triggers on "daily work" or "improvement cycle" — sequences a full improvement cycle across all repos, dispatching parallel agents for work-heavy phases.
---

# Daily Work — Entry Point

You are the daily-work orchestrator. You sequence a full improvement cycle across all repos, dispatching parallel agents for the work-heavy phases and running serial phases as bookends.

**Trigger:** `"daily work"`, `"daily-work"`, `"improvement cycle"`

**Policy:** Read `.claude/skills/daily-work/policy.md` before starting. All rules apply to every phase.

Skills: `.claude/skills/daily-work/`
Artifacts: `docs/daily-work/`

---

## Phase List

After each serial phase, produce a compact summary:
- **What was done** (PRs opened, issues fixed, items skipped, etc.)
- **Work signal** — explicitly state `work: yes` or `work: no`

Parallel agents write their summaries to files (see below). You do not narrate their work — you dispatch and wait.

---

### Phase 1: Repo Sync (serial)

Run skill: `.claude/skills/daily-work/repo-sync.md`

→ Produce compact summary with `work: yes|no`

---

### Phases 2–6: Parallel Dispatch

**Before dispatching:** record the current timestamp as `CYCLE_TS` in format `YYYY-MM-DD-HH-MM` (e.g. `2026-05-03-14-22`). Every summary file path below uses this prefix.

**Productivity-aware mix (advisory):** before fixing the slot:role allocation, run `node scripts/cycle-productivity.mjs --window=5 --budget=<N>` (or `--json` for parsing). The script reads the last N receipts, scores each lane (frontend / gateway / infra / capture / wildcard / bugs / agent-ideation) by `shipped/dispatched`, and emits a recommended slot:role list. Treat it as a suggestion, not a gate — override when there's a specific reason (e.g. user requested a custom mix, a hot lane just shipped a structurally-blocking PR that drains its queue, etc.). Cold lanes are recommended for skipping; hot lanes for double-slotting when budget allows.

**Docs throttle check:** Count completed-cycle rows in `docs/daily-work/index.md` — lines that start with `|` and contain a receipt link, excluding the header and separator rows. Call this count `N`.
- If `N % 3 != 0`: Phase 5 is throttled. Write `docs/daily-work/summaries/CYCLE_TS-phase5-docs.md` yourself with:
  ```
  work: no
  Docs/wiki throttled — runs every 3rd cycle (current cycle N).
  ```
  Do **not** dispatch a Phase 5 agent.
- If `N % 3 == 0`: dispatch Phase 5 agent normally.

**Slot provisioning (do this before dispatching any agent):**

Slots are persistent: `.claude/worktrees/slot-1/` … `.claude/worktrees/slot-7/` are pre-bootstrapped pools containing all 5 sub-repo worktrees plus a stable `.orobot-env`. They are reused cycle-to-cycle. Per-cycle provisioning is just a branch reset:

```bash
# Cycle id derived from CYCLE_TS, e.g. dw-1850 for 18:50.
CYCLE="dw-$(echo "$CYCLE_TS" | sed 's/[^0-9]//g' | tail -c 5)"

# Slot:role pairs — omit 5:p5-docs if Phase 5 is throttled.
scripts/slot-checkout.sh "$CYCLE" \
  1:p2-bugs 2:p3-features 3:p4-ideation 4:p5-docs 5:p6-agentideation
```

`slot-checkout.sh` runs in seconds. It pre-fetches each base branch once into the source repos, then in parallel resets each slot's repos to `session/<cycle>-<role>` from `origin/<base>`. The working tree only updates the diff between the previous and new tip — typically tens of files, not thousands. Refuses to clobber a dirty slot.

If a slot doesn't exist (first run or slot was deleted): `scripts/slot-bootstrap.sh <slot>` materializes it. Bootstrap is one-time; checkout is the per-cycle path.

Each agent must `source .claude/worktrees/slot-N/.orobot-env` and do all sub-repo git work inside `.claude/worktrees/slot-N/<repo>/`.

Each agent must write its summary to `docs/daily-work/summaries/CYCLE_TS-<phase-id>.md` before exiting.

Wait for all dispatched agents to complete before proceeding to Phase 7. Persistent slots are not torn down — the next cycle will reset their branches via `scripts/slot-checkout.sh`.

---

#### Preamble Construction (cache-friendly prompt assembly)

Phase 2 and Phase 4 agent prompts are assembled from **preamble files + a per-agent task block**, in that order, byte-identical across siblings:

```
<preamble-base.md content>            ← shared across ALL daily-work agents
<preamble-{phase}.md content>         ← shared across all agents in a phase (e.g. all 4 ideation agents)
<per-agent task block>                ← the only variable portion: slot, summary path, lane, role
```

The intent: when N agents dispatch in parallel (e.g. 4 ideation agents) with byte-identical leading content, Anthropic's prompt cache should hit across siblings — each cached call reads precomputed KV state instead of re-prefilling 12K+ tokens of policy and skill body. The expected wins were ~90% input-cost discount on the cached portion, with latency benefits compounding across cycles within the cache TTL.

**Empirical status (verified 2026-05-09):** the cross-sibling cache **does NOT fire** as theorized. Each parallel `Task()` invocation writes its own preamble cache entry independently — siblings only hit the smaller upstream Claude Code system+memory cache (~8.7K), not the inlined preamble (~12K for ideation, ~20K for bugs). The savings observed in cycles (86%+ vs all-uncached) come from intra-agent reuse (same agent reading its own write back across many turns), which would happen with or without the preamble pattern. Run `node scripts/cache-report.mjs --cycle <YYYY-MM-DD-HH-MM>` to re-validate after any future change to the dispatch path. **Don't invest more in this pattern until the underlying mechanism is understood** — the inlined preambles are still useful as colocated docs, but their cache rationale is unproven.

Files:
- `.claude/skills/daily-work/preamble-base.md` — common to every daily-work agent
- `.claude/skills/daily-work/preamble-bugs.md` — concatenated after base for Phase 2
- `.claude/skills/daily-work/preamble-ideation.md` — concatenated after base for Phase 4

Read both files at dispatch time (don't `cat` them into the agent's terminal — read them yourself, concatenate in memory, pass as the leading bytes of the Agent tool's `prompt` parameter, then append the per-agent task block).

If you edit `policy.md`, `issue-fixer.md`, or `ideate/SKILL.md`, regenerate the corresponding preamble file to match — drift breaks agent behavior even though it doesn't (currently) break a cache key. The preamble files name their authoritative source in their header comment.

Phases 3, 5, 6 still use the older "Read policy.md before starting" pattern — extension is paused pending the cache-mechanism investigation above.

---

#### Phase 2 Agent — Bug Triage

**Summary file:** `docs/daily-work/summaries/CYCLE_TS-phase2-bugs.md`
**Slot:** `slot-1`

**Preamble:** `preamble-base.md` + `preamble-bugs.md` (assembled per "Preamble Construction" above)

**Per-agent task block** (appended after preamble — variable portion only):
```
---

# Your Phase 2 Assignment

You are the Phase 2 Bug Triage agent for cycle <CYCLE_TS>.

Your slot: slot-1
Your first command: `source .claude/worktrees/slot-1/.orobot-env`

Follow the Issue Fixer Flow described in your preamble. The orobot-firmware bug discovery fallback (`.claude/skills/bugs/SKILL.md` discovery + sync mode) is only needed if Tier 4/5 work is empty after filtering.

When done, write your summary to:
  docs/daily-work/summaries/<CYCLE_TS>-phase2-bugs.md

Format:
  work: yes|no
  <compact issue-fixer output: PRs opened, issues claimed/skipped, supplemental skipped reason>
```

---

#### Phase 3 Agent — Feature Requests

**Summary file:** `docs/daily-work/summaries/CYCLE_TS-phase3-features.md`
**Slot:** `slot-2`

Agent prompt:
```
You are the Feature Requests agent for a daily-work cycle.

Your slot: slot-2
First command: source .claude/worktrees/slot-2/.orobot-env
All sub-repo git work must happen inside .claude/worktrees/slot-2/<repo>/ — never in the base clones.

Read `.claude/skills/daily-work/policy.md` before starting.

Run skill `.claude/skills/daily-work/feature-requests.md`.

When done, write your summary to docs/daily-work/summaries/CYCLE_TS-phase3-features.md:
work: yes|no
<compact feature-requests output>
```

---

#### Phase 4 Agent — Ideation

**Summary file:** `docs/daily-work/summaries/CYCLE_TS-phase4-ideation[-LANE_SUFFIX].md`
**Slot:** `slot-3` (default) — or `slot-2/3/4/5` when running multi-lane ideation per cycle config

**Preamble:** `preamble-base.md` + `preamble-ideation.md` (assembled per "Preamble Construction" above)

**Per-agent task block** (appended after preamble — variable portion only):
```
---

# Your Phase 4 Assignment

You are a Phase 4 Ideation agent for cycle <CYCLE_TS>.

Your slot: slot-<N>
Your first command: `source .claude/worktrees/slot-<N>/.orobot-env`

Your lane: <one of: frontend / gateway / infra / capture> (or `default` if single-agent).
  - frontend: orobotio React/Redux/MUI components, hooks, IDE/Parts Builder UI, accessibility, perceived perf.
  - gateway: robots-gateway / backend — REST, WS, auth, Sequelize, PubSub, Firestore, deploy. Cross-cutting Tier-1 features that touch BOTH orobotio and gateway are also yours.
  - infra: tests/observability/dev tooling — vitest coverage, integration tests, OpenTelemetry, structured logging, dev tooling, MCP, slot system. Pure code-quality refactors that don't touch user behavior.
  - capture: SEO/growth/affiliate/monetization — see `docs/capture/strategy.md` for priority map.
  - default: all lanes (single-agent mode).

Stay strictly inside your lane to avoid colliding with sibling agents in other slots.

Sequence (Sync → Ideate-if-empty → Implement) is described in your preamble. Run 2 ideate cycles maximum if your lane is empty after sync.

When done, write your summary to:
  docs/daily-work/summaries/<CYCLE_TS>-phase4-ideation[-<lane-suffix>].md

  (Use `-a/-b/-c/-d` suffixes when multi-lane; omit suffix in single-agent mode.)

Format:
  work: yes|no
  <compact summary: ideas synced (N pulled / N pushed / N closed), ideate cycles run (N) producing N ideas, PRs opened (list with #numbers), ideas blocked (list), items skipped and why>
```

---

#### Phase 5 Agent — Docs & Knowledge

**Summary file:** `docs/daily-work/summaries/CYCLE_TS-phase5-docs.md`
**Slot:** `slot-4`
**Only dispatched when not throttled (see docs throttle check above)**

Agent prompt:
```
You are the Docs & Knowledge agent for a daily-work cycle.

Your slot: slot-4
First command: source .claude/worktrees/slot-4/.orobot-env
All sub-repo git work must happen inside .claude/worktrees/slot-4/<repo>/ — never in the base clones.

Read `.claude/skills/daily-work/policy.md` before starting.

Steps:
1. Run skill `.claude/skills/docs-updater/SKILL.md` — wait for completion.
2. Run skill `wiki-compiler` (plugin skill).

When done, write your summary to docs/daily-work/summaries/CYCLE_TS-phase5-docs.md:
work: yes|no
<compact docs summary>
```

---

#### Phase 6 Agent — Agent Ideation

**Summary file:** `docs/daily-work/summaries/CYCLE_TS-phase6-agent-ideation.md`
**Slot:** `slot-5`

Agent prompt:
```
You are the Agent Ideation agent for a daily-work cycle.

Your slot: slot-5
First command: source .claude/worktrees/slot-5/.orobot-env
All sub-repo git work must happen inside .claude/worktrees/slot-5/<repo>/ — never in the base clones.

Read `.claude/skills/daily-work/policy.md` before starting.

Steps:
1. Check `docs/agent-ideate/index.md` for open unblocked proposals.
2. If none exist:
   - Run skill `.claude/skills/agent-ideate/SKILL.md` — 2 cycles only.
   - Mark new proposals as *implement this*.
3. Implement all approved proposals.

When done, write your summary to docs/daily-work/summaries/CYCLE_TS-phase6-agent-ideation.md:
work: yes|no
<compact agent-ideation summary>
```

---

### Phase 7: CI Reconciliation (serial)

Run skill: `.claude/skills/daily-work/ci-reconciler.md`

→ Produce compact summary with `work: yes|no`

---

### Phase 8: Cycle Receipt (serial)

Run skill: `.claude/skills/daily-work/cycle-receipt.md`

Pass `CYCLE_TS` to the receipt skill (include it in the prompt so the skill knows which summary files to glob).

---

## Loop Control

After Phase 8, read all summary files matching `docs/daily-work/summaries/<actual-CYCLE_TS>-*.md` (substitute the value you recorded at cycle start). Also include the in-memory summaries from Phase 1 (Repo Sync) and Phase 7 (CI Reconciliation), which are produced inline and not written to disk.

If any expected summary file is missing (agent crashed or timed out), treat that phase as `work: no` and note the missing file in the receipt.

Check work signals:

### Work was done
If **any phase reported `work: yes`** → schedule next iteration.

**Harness-aware rescheduling:**
- **Claude Code** (`$CLAUDE_CODE_SSE_PORT` set): `ScheduleWakeup` (dynamic pacing).
- **opencode** (`$OPENCODE` set): Rescheduling is external. The human must re-invoke the cycle. Print the following marker so automation can pick it up:

  ```
  ==RESCHEDULE== cycle=<CYCLE_TS> reason=work_found
  ```
  
  Do NOT attempt `ScheduleWakeup` — it is a Claude Code-only tool and will fail silently or error.

### Noop cycle
If **ALL phases reported `work: no`** → this is a **noop cycle**. Do not reschedule. Exit the loop. A human should review the noop theory in the receipt before restarting.

A noop cycle means ideation phases failed to generate ideas. That is a failure of imagination, not a sign the project is done.

---

**Cleanup:** After the loop control decision (regardless of which branch was taken), delete all summary files for this cycle:

```bash
rm docs/daily-work/summaries/<actual-CYCLE_TS>-*.md 2>/dev/null || true
```

(substitute the actual CYCLE_TS value, e.g. `rm docs/daily-work/summaries/2026-05-03-14-22-*.md 2>/dev/null || true`)
