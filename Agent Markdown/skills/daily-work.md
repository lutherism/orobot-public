---
name: ideate
description: A skill for discovering tracking and implementing feature ideas. 3 primary modes: create, sync, implement.
---

# Ideate & Implement — Entry Point

You are the ideation and implementation agent. You operate in one of two modes based on how you were invoked:

- **"ideate"** → Ideate Mode — explore the app as a persona, find friction, record ideas
- **"ideate sync"** → Sync Mode — reconcile index.md with GitHub Issues bidirectionally
- **"implement ideas"** → Implement Mode — pick approved ideas and ship them as PRs

Skills: `.claude/skills/ideate/`
Artifacts: `docs/ideate/`
Template: `.claude/skills/ideate/template.md`

---

## Config

```
APP_URL: http://localhost:3000

REPOS:
  orobotio       → orobotio/        (base branch: main)
  robots-gateway → robots-gateway/  (base branch: master)
```

---

## Ideate Mode

An infinite loop. A single exploration cycle may record multiple ideas — one per distinct friction the persona hits while pursuing their goal. Do not stop.

```
Orient → Embody → Explore ⇄ (Crystallize → Record → Recover) → back to Orient
```

The inner loop (Explore / Crystallize / Record / Recover) runs until the persona either completes their goal or genuinely gives up. Each time the persona hits friction that clears the quality bar, record it and then take the recovery path a real user would take — a workaround, a retry, checking docs, asking a friend, whatever keeps them moving toward the same goal. Do not fabricate recovery just to keep the run going; if the persona would have quit in real life, the cycle ends.

### Phase 1: Orient

Before each cycle, read both:
- `docs/ideate/index.md` — what ideas have already been captured
- `docs/ideate/exploration-log.md` — which personas, areas, and routes have already been run

**A* heuristic — read the productive-work signal before selecting where to explore:**

```bash
git log --oneline --since="7 days ago" -- orobotio/ robots-gateway/ | head -30
```
Also read the last 2 cycle receipts in `docs/daily-work/receipts/`. Extract which app areas (auth, programs, devices, operator UI, program IDE, robot browser, email flows, etc.) recent PRs and bug fixes touched.

Rank your next exploration target using this signal:
- **Hot zone** (explore first): App area adjacent to recently merged work. A bug fix in auth → explore password reset, email verify, OAuth, session expiry. A new feature in the program IDE → explore deploy flow, operator panel, config editor. Recent changes are a leading indicator — undiscovered friction clusters around where work just happened.
- **Warm zone**: App areas with open ideas in the index but no recent exploration log entries.
- **Cold zone**: Areas with no recent git activity and no tracked ideas — explore last.

Only fall back to pure coverage-gap rotation (least-explored areas) when there is no productive signal.

After applying the A* signal: identify gaps within your chosen zone — which **user types** and **specific routes** through that area have had the least coverage? Target those deliberately.

Look at the last 3 entries in the exploration log specifically. If those entries share a skill level, role type, or app area, your next cycle must differ on at least two of those dimensions.

**App areas to rotate through:**
- Onboarding (new user, first visit, no account)
- Program creation (writing code, config, testing)
- Robot browsing and installation
- Robot operation (live control, console, logs)
- Discovery (finding programs made by others)
- Social (profiles, sharing, following, comments)
- Device setup (pairing a new physical device)
- Settings and account management
- Mobile / tablet experience
- **Code writing + device execution** (write a program, deploy to simulator, run and read logs) ← underexplored, prioritize
- **Email flows** (welcome on signup, email verification, password reset, weekly digest, newsletter, reengagement) — the parts of the product that happen in the inbox, not on the page

### Phase 2: Embody

Choose a specific persona. Be concrete — a real person, not a category. Pick dimensions that differ from recent runs:

- **Role:** student / hobbyist / robotics club teacher / maker / researcher / office demo builder / parent helping a kid / professional integrator
- **Skill:** total beginner / can follow tutorials / writes code / has done robotics before
- **Goal today:** something specific they want to accomplish in the next 20 minutes
- **Social context:** alone / showing someone / collaborating / competing
- **Device:** desktop / laptop at school / phone while robot is running in front of them
- **Prior app experience:** first time / used it once before and got stuck / regular user

Write one sentence defining who you are before you start exploring. Example: *"I'm a high school robotics teacher prepping a class demo. I have 20 minutes before students arrive and I've used the app once before."*

### Phase 3: Explore

**Before exploring, always log out first** to get a blank-slate experience matching your persona's account state:

**Clean slate means two things:**

1. **Latest code:** Before exploring, ensure all repos are on their base branch with the latest code pulled (`git checkout main && git pull` in `orobotio/`, `git checkout master && git pull` in `robots-gateway/`). Restart dev services if needed so the running app reflects the latest production state.

2. **Logged out:** Navigate to `http://localhost:3000/auth/logout` before starting each exploration session. If your persona would have an account (e.g. returning user), log back in as a test user. If your persona is a first-time visitor, stay logged out.

Use browser automation on `localhost:3000`. Use `orobot-cli` and `orobot-console` to scaffold realistic situations: create test users, devices, robots, programs as needed to simulate the scenario.

**Scaffolding a device scenario:** For personas who own a robot, use the firmware simulator as your backstage scaffolding — the persona doesn't know it exists.

- **Claude Code:** Start via `dev_start('orobot-firmware simulator')`. A dashboard at `http://localhost:4000` lets you manage the simulation.
- **opencode or other harness:** Start manually: `cd orobot-firmware && npm run dev`. Depends on `dev_start()` MCP being absent.
- Provision new simulated devices: `POST http://localhost:4000/api/devices` with `{"name": "My Robot"}`
- Connect a device to the gateway: `POST /api/devices/:id/connect`
- Observe pin activations and device logs in real time at the dashboard UI or via SSE at `/api/events`

From the persona's perspective she bought a real robot and it's sitting on her desk. You're just making it appear in the app so her experience is realistic.

**Scaffolding an email scenario:** When your persona's goal involves email (signup, verification, password reset, digests, etc.), treat the inbox as part of the product surface — it's where the flow actually plays out.

- **Always use `@mailsac.com` addresses** when creating test users. Mailsac is a disposable-inbox service and `@mailsac.com` is hard-baked into the gateway's recipient allowlist (`DEFAULT_ALLOWLIST` in `robots-gateway/src/modules/infra/email.ts`). Any non-mailsac address will be silently rejected by `isRecipientAllowed()` before the send, so you'll see nothing in any inbox and nothing will tell you why.
- **Create via `orobot-cli users create` with a mailsac address**, e.g. `orobot-test-<persona-slug>@mailsac.com`. No mailbox setup is needed — mailsac creates inboxes on first receipt.
- **Read the inbox at `https://mailsac.com/inbox/<full-address>`** (no auth). Messages usually land within a few seconds. If the inbox is empty after ~30s, check `dev_logs('robots-gateway')` for a send error — the most common causes are a non-allowlisted address or a merge-var guard rejection (logged as `[email] blocked <template> → <to>: missing merge vars …`).
- **Trigger real sends by having the persona perform the action**, not by using the admin tester. The whole point is to test the flow end-to-end: signing up produces the welcome email, clicking "forgot password" produces the reset email, the newsletter cron produces the digest. If you shortcut the trigger, you're not exploring the flow — you're just previewing a template.
- **For isolated template preview (no delivery, no persona flow)**, the admin email-tester at `http://localhost:3002/a/email-tester` (orobot-console) renders any template against real aggregator data and optionally sends to a chosen mailsac address. Use this when you want to inspect copy or layout outside a user journey — not as a substitute for Phase 3 exploration.
- **Newsletter / digest / reengagement** don't fire on a user action; they're cron-driven. To exercise them in a persona run, either wait for the cron or manually trigger the cron handler (via `dev_start` on Claude Code, or by hitting the admin trigger in orobot-console) and then return to the persona's inbox to read what arrived.

Judge the email the way your persona would: does the subject make them open it, does the body tell them what to do next, does the call-to-action land somewhere that matches what the email promised? Friction in an email is as real as friction in the UI.

**Account hygiene:** Unless the persona's situation explicitly requires an account with prior history (e.g. "returning user who got stuck"), always create a fresh test account for each session using `orobot-cli users create`. Do not reuse accounts from previous sessions — leftover robots, programs, and devices pollute the experience and make friction hard to attribute to the app vs. pre-existing state.

**Try to accomplish your persona's goal.** Don't tour the app — pursue something. Friction, confusion, and dead ends are the signal.

**When you hit friction, don't stop exploring.** Record the friction (Phase 4 → Phase 5), then take the recovery path a real user in this persona would take and keep pursuing the same goal. The next friction on the recovery path is often more revealing than the first — users who give up never get to expose the downstream issues. Examples of realistic recovery:
- Couldn't find a button → checks the menu, then settings, then gives up and googles it
- Form submission failed → reloads, tries a different input, looks for an error message
- Email never arrived → checks spam, waits, tries the "resend" link
- Something broke mid-flow → refreshes, retraces the steps, tries a different entry point

Continue until the persona either completes the goal or hits a friction so severe a real user would abandon and walk away. Abandonment is also signal — record that friction as the final idea of the cycle.

Exploration routes to try (rotate across cycles, don't always start from home):
- Try to share something you made with someone else
- Try to pick up where you left off after a gap
- Try to figure out if this app can do what you need before committing
- Try to operate a robot live for the first time
- Try to explain the app to an imaginary friend watching over your shoulder
- Try to find something made by another user
- Try to recover from something going wrong
- Try to write a custom program for your robot, deploy it, and make it do something specific
- Try to figure out why your robot isn't behaving right (check logs, read console output, trace back to code)
- Try to modify a program you already deployed and see the change take effect on your robot
- Try to sign up and actually read the welcome email — does it tell you what to do next?
- Try to verify your email and return to the app to continue onboarding
- Try to reset a forgotten password end-to-end, from "forgot password" link to logging back in
- Try to unsubscribe from one category (e.g. newsletter) and confirm other categories still land
- Try to receive the weekly digest / newsletter and follow a link back into the app — does the landing page match what the email promised?

Research external inspiration when relevant. Look at how GitHub, YouTube Studio, Google Docs, TikTok Creator, Notion, Discord, or Arduino IDE handle similar moments.

### Phase 4: Crystallize

Each time the persona hits friction, confusion, or an unmet expectation during Phase 3, pause and crystallize it before taking the recovery path. Ground the idea in that specific moment — not in abstract possibility.

Ask: *What would have made this moment better?* The solution can be ambitious. The problem must be real and observed.

**Quality bar for an idea (applies to every friction recorded, not just the first):**
- Tied to a specific observed moment (not "it would be cool if...")
- Grounded in a real user type with a real goal
- The absence of this feature actively costs something (time, confidence, trust)
- Distinct from frictions already recorded this cycle — if it's a symptom of the same underlying problem, fold it into the first idea instead of duplicating

If a friction doesn't clear the bar, don't record it — keep exploring. Not every papercut deserves a feature request; the goal is signal, not volume. After recording, go to Phase 5, then resume exploration (Phase 3) from the recovery path, still chasing the same persona goal.

### Phase 5: Record

Check `docs/ideate/index.md` — if a nearly identical idea exists, skip recording and return to Phase 3 (continue exploring with the persona; don't start a new cycle just because one friction was a dup).

Otherwise:
1. Create a new file in `docs/ideate/` named by a short slug (e.g. `mobile-live-controls.md`)
2. Follow the format in `.claude/skills/ideate/template.md` exactly
3. Add an entry to `docs/ideate/index.md` in the required format
4. Append one line to `docs/ideate/exploration-log.md` per friction recorded. When a single cycle produces multiple ideas, append one line per friction in the order they were hit, so the causal chain is visible:

#### `obvious-fix` auto-promotion (no human gate required)

The default flow leaves new ideas without a status marker so a human reviewer can approve them with `*implement this*`. That gate exists for safety on user-facing or cross-cutting work. For atomic, empirically-grounded **Tier 6+** fixes (tests, dev-infra, CI, build tooling, doc-only — not orobotio/gateway src/ feature work), the gate adds no risk-mitigation signal and creates an unnecessary one-cycle delay.

If **all six** of the following hold for an idea you just filed, mark it `*implement this*` directly:

1. **Diff size:** ≤ 5 changed lines AND ≤ 1 file modified.
2. **Empirical verification:** the idea body cites a concrete observation proving the bug exists today (command output, grep result, reproducible failure, measured before/after).
3. **Tier 6 or higher** per `.claude/skills/daily-work/policy.md` — pure tests / dev-infra / CI / docs surface, no orobotio or robots-gateway src/ business code.
4. **No new APIs, no new dependencies, no schema changes.** No new exported names, no `package.json` `dependencies`/`devDependencies` additions, no Sequelize/Firestore changes.
5. **Atomicity guarantee in the idea body:** explicit "Atomicity guarantees" or equivalent section confirming reverting is one commit and the change has no conflict surface with in-flight feature PRs.
6. **No security or auth posture change.** Touches no auth middleware, rate-limit config, CORS, cookie/session code, or allowlist.

If any of the six fails, leave the marker blank — that's the human-review path. When Sync Mode pushes an `obvious-fix` idea to GitHub, also apply the `obvious-fix` label so reviewers can see the auto-promotion path was used.

```
YYYY-MM-DD | <role>, <skill level> | <app area> | <exploration route> | friction: <one sentence>
```

Example — two frictions from the same exploration run (the second was discovered on the recovery path from the first):
```
| 2026-04-07 | high school teacher, non-technical | program creation → sharing | try to share something | friction: no way to share a read-only preview link with students |
| 2026-04-07 | high school teacher, non-technical | program creation → sharing | try to share something (recovery: copied code into a gist) | friction: pasted code loses config.json context, recipient can't run it |
| 2026-04-07 | parent helping 10yo, beginner | onboarding | first robot install | friction: no age-appropriate entry point, assumed technical literacy immediately |
```

After recording, return to **Phase 3** and continue the same persona's run from the recovery path — do **not** jump to Phase 1 yet. Only begin the next cycle (Phase 1, new persona) when the current persona has completed their goal, given up, or produced enough distinct ideas that further exploration would be padding.

**Constraints:**
- No implementation details. If you catch yourself thinking about databases or APIs, stop.
- Multiple ideas per cycle are allowed, but each must clear the full quality bar independently. Depth over volume — a single sharp friction beats three mediocre ones.
- The problem must be observed, not imagined. You must have tried to do something and hit a wall.
- Recovery must be realistic. If the persona would have given up, end the cycle — don't invent a reason to keep exploring.
- If two frictions on the same run trace back to the same underlying issue, consolidate into one idea; list both observations inside its **User demands** section.
- Vary your persona every cycle. If your last three personas were technical, be non-technical next.

---

## Sync Mode

Bidirectionally reconcile `docs/ideate/index.md` with GitHub Issues in the `lutherism/orobotio` repo.

**Trigger:** `"ideate sync"`

Run this mode before Implement Mode to ensure local state matches GitHub.

### Pull (GitHub → local)

For each open GitHub Issue in `lutherism/orobotio` with `implement-this` label:

1. Search `docs/ideate/index.md` for a line containing `GitHub Issue: lutherism/orobotio#<number>`.
2. If **not found**, check if a local idea file references that issue number anywhere in `docs/ideate/*.md`.
3. If still not found:
   - Read the issue body via `gh issue view <number> --repo lutherism/orobotio --json title,body,labels`.
   - Create a new idea file `docs/ideate/<slug>.md` using the template format. Populate from the issue body — many decomposed sub-issues already contain the full Idea Concept format.
   - If the issue body references a parent issue (`Parent: #NNN`), note that in the idea file.
   - Add an entry to `docs/ideate/index.md` with the appropriate status marker:
     - Issue has `in-progress` label → `*in progress*`
     - Issue has `blocked` label → `*blocked*`
     - Issue has `complete` label → `*complete*`
     - Issue has `implement-this` label → `*implement this*`
     - Otherwise → no marker
   - Include `GitHub Issue: lutherism/orobotio#<number>` on the line after the description.
4. If found but the **status marker doesn't match** the issue labels, update the index entry to match GitHub labels.

### Push (local → GitHub)

For each entry in `docs/ideate/index.md` where there is **no** `GitHub Issue:` line:

1. Read `docs/ideate/<slug>.md` to get the title, description, and user demands.
2. Create a GitHub Issue:
   ```bash
   gh issue create --repo lutherism/orobotio --title "<title>" --body "<idea summary + user stories>" --label "enhancement"
   ```
3. If the index entry has `*implement this*`, also add the `implement-this` label:
   ```bash
   gh issue edit <number> --repo lutherism/orobotio --add-label "implement-this"
   ```
4. Store the returned issue number in:
   - `docs/ideate/<slug>.md` — add `GitHub Issue: lutherism/orobotio#<number>` line
   - `docs/ideate/index.md` — add `GitHub Issue: lutherism/orobotio#<number>` after the description

### Close (local complete → GitHub open)

For each entry where local status is `*complete*` and a GitHub Issue is set:

```bash
gh issue close <number> --repo lutherism/orobotio
```

### Pull-close (GitHub closed → local open)

For each entry where local status is NOT `*complete*` and a GitHub Issue is set:

```bash
gh issue view <number> --repo lutherism/orobotio --json state
```

If `state` is `CLOSED`:
- Update `docs/ideate/index.md` entry: change status to `*complete*`.

### Orphan check

After all sync operations, scan `docs/ideate/*.md` for any idea file NOT referenced in `docs/ideate/index.md` (excluding `index.md`, `exploration-log.md`). For each orphan:
- Read the file to get its title and description
- Add an entry to `docs/ideate/index.md`

**Output a summary to console:**
```
Ideate sync complete: N pulled from GitHub, N pushed to GitHub, N closed, N orphans added to index
```

---

## Implement Mode

```
Select → Validate → Spec → Plan → Implement → UX Validation → back to Select
```

After completing one idea, immediately return to Select. Do not stop until all approved ideas are implemented or blocked.

If there are no ideas marked `*implement this*` in the index, stop and output: "No approved ideas remaining. Awaiting human review."

### Phase 1: Select

Read `docs/ideate/index.md`.

Pick the next idea marked `*implement this*` that has a `GitHub Issue:` reference. Prefer the simplest, most self-contained idea first to minimize blast radius on early cycles.

If an idea depends on another unimplemented idea (e.g. share links require guest auth that doesn't exist yet), note the dependency in the idea file and skip to the next one.

**Parallel agent coordination — claim before starting:**

Multiple implement agents may run concurrently. Before working on any idea, use a comment-based claim to prevent duplicate work. GitHub comments are synchronous — a POST followed immediately by a GET will see the comment — making them a reliable coordination primitive without any wait.

1. **Check availability:** Query the issue's current labels:
   ```bash
   gh issue view <number> --repo lutherism/orobotio --json labels --jq '.labels[].name'
   ```
   - If the issue has an `in-progress` label, **skip it** — another agent is already working on it. Move to the next `*implement this*` idea.
   - If the issue does NOT have `implement-this` label, **skip it** — it's not approved or was already claimed.

2. **Post a claim comment** with your session slot as identity:
   ```bash
   gh issue comment <number> --repo lutherism/orobotio --body "claiming: slot-$OROBOT_SLOT"
   ```

3. **Verify you won the race** — immediately query comments (no wait needed, comments are consistent):
   ```bash
   gh api repos/lutherism/orobotio/issues/<number>/comments \
     --jq '[.[] | select(.body | startswith("claiming:"))] | sort_by(.created_at) | .[0].body'
   ```
   - If the result contains your slot ID (`slot-$OROBOT_SLOT`), you have the claim — proceed.
   - If it contains a different slot ID, another agent posted first. **Back off:** pick a different `*implement this*` idea. Do not delete your comment — leave it so the winning agent can see it competed.

4. **Apply the in-progress label** to make status visible:
   ```bash
   gh issue edit <number> --repo lutherism/orobotio --remove-label "implement-this" --add-label "in-progress"
   ```

5. **Update local index:** Change the status marker in `docs/ideate/index.md` from `*implement this*` to `*in progress*`.

Only proceed to Phase 2 after the claim succeeds. If no unclaimed ideas remain, stop and output: "No unclaimed ideas remaining. Other agents may still be working."

### Phase 2: Validate

Read the full idea file (`docs/ideate/<slug>.md`). Answer these three questions before proceeding:

**1. Is this shippable as one atomic PR?**
If the idea requires new infrastructure, multiple backend systems, or is clearly more than a few days of focused work, decompose it into smaller sub-ideas. Add an `## Implementation Notes` section to the idea file describing the decomposition, then stop — a human will re-mark which sub-idea to implement first.

**2. Are there safety or security gaps that make this unsafe to ship as described?**
e.g. a public share link with no expiry or revocation is a security problem. If there's a gap that can't be resolved without human input, note it in the idea file and move to the next idea.

**3. Does this already exist?**
Read relevant source files before assuming something needs to be built. If partial coverage already exists, note it and scope accordingly.

If validation fails for any reason, add `## Implementation Notes` to the idea file with a clear explanation, mark it `*blocked*` in `docs/ideate/index.md`, update GitHub labels (`--remove-label "in-progress" --add-label "blocked"`), then continue to the next idea.

### Phase 3: Spec

Use the **superpowers:brainstorming** skill.

- Set up a git worktree first using **superpowers:using-git-worktrees**
- Produce a design doc saved to the relevant repo's `docs/superpowers/specs/YYYY-MM-DD-<idea-name>-design.md`
- Cover: UI changes, new API routes, data model changes, test strategy
- Scope tightly — only what satisfies the idea, nothing adjacent

### Phase 4: Plan

Use the **superpowers:writing-plans** skill to produce a task-by-task implementation plan saved to the relevant repo's `docs/superpowers/plans/`.

The plan must include:
- Exact files to create or modify
- Tests written before implementation (TDD)
- Backend and frontend as separate tasks if both are needed
- One commit per logical unit of work

### Phase 5: Implement

Use the **superpowers:subagent-driven-development** skill to execute the plan.

**Standards:**
- Run all tests which changes
- Tests must pass before opening a PR
- New features must have test coverage — no untested happy paths
- Follow existing codebase patterns: `reduxXHR` for API calls, Sequelize for SQL models, Firestore for flexible per-entity metadata
- One PR per repo, targeting `main` / `master`
- If any new SQL tables or columns are added, include a `## Cloud configuration` section in the PR description with the raw `CREATE TABLE` or `ALTER TABLE` SQL

**After the PR is open:**
- Proceed to Phase 6: UX Validation before marking complete

**If you hit a blocker mid-implementation:**
- Mark the idea as `*blocked*` in `docs/ideate/index.md`
- Update GitHub labels — remove `in-progress`, add `blocked`:
  ```bash
  gh issue edit <number> --repo lutherism/orobotio --remove-label "in-progress" --add-label "blocked"
  ```
- Add `## Implementation Notes` to the idea file explaining exactly what stopped you and what a human needs to decide
- Move to the next idea — do not thrash

### Phase 6: UX Validation

Before marking the idea complete, re-run the exact scenario that produced the idea and confirm the friction is gone.

**Step 1: Reconstruct the persona and goal**

Read the idea file's **User demands** and **User Stories** sections. Read the corresponding line in `docs/ideate/exploration-log.md` to find the exact persona, app area, and route that produced this idea.

**Step 2: Explore as that persona**

Use browser automation on `localhost:3000` (the local dev stack, which has the feature branch code). Embody the persona from the exploration log. Attempt the same goal that produced the original friction — not a tour of the new feature, but a genuine attempt to do the thing the user was trying to do.

**Step 3: Evaluate against the User Stories**

For each User Story in the idea file, mark it as one of:
- ✅ Satisfied — the story can now be completed without friction
- ⚠️ Partial — the story is better but still has a notable gap
- ❌ Unsatisfied — the original friction is still present

**Step 4: Record the outcome**

Add a `## UX Validation` section to the idea file with:
- The persona and goal re-used
- Results per User Story (✅ / ⚠️ / ❌)
- Any new friction observed that should become a new idea

**If all stories are ✅ or ⚠️ with minor gaps:**
- Mark the idea as `*complete*` in `docs/ideate/index.md`
- Update GitHub labels — remove `in-progress`, add `complete`:
  ```bash
  gh issue edit <number> --repo lutherism/orobotio --remove-label "in-progress" --add-label "complete"
  ```
- Return to Phase 1

**If any story is ❌:**
- Do not mark complete
- The implementation has a gap — fix it, then re-run Phase 6
- If the fix requires significant rework, mark `*blocked*` and note what a human needs to decide

**Guardrails:**
- Do not refactor code unrelated to the idea
- Do not add features the idea doesn't describe — if you spot a related improvement while implementing, create a new idea file in `docs/ideate/` instead of expanding the PR
- If you hit a genuine blocker mid-implementation (broken assumption, missing dependency, design conflict), document it in the idea file and move on — do not thrash
