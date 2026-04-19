# agent-design-robot

Orchestrates the full agent-robot pipeline. Input: a robot spec. Output: JSCAD parts in the Parts Builder, a live program on orobot.io, and a quality scorecard.

## Input

- `spec` — a robot spec describing actuator type, mount surface, dimensions, and behavior

## Pipeline Stages

### Stage 1: Part Designer (JSCAD definitions)

Use the `part-designer` skill with the spec. This:
1. Reads the spec
2. Determines required parts from actuator_type
3. Authors JSCAD part definition JSONs with socket types from the canonical set
4. Saves the part definitions

### Stage 2: Part Creation (Playwright)

For each part definition JSON from Stage 1, drive the Part Editor UI using the `parts-builder-playwright` skill:
1. Navigate to `https://orobot.io/o/parts-builder/parts/new`
2. Fill name, slug, category
3. Paste JSCAD source into the code editor
4. Add each parameter row
5. Add each socket row
6. Click Save
7. Screenshot to verify 3D preview
8. Record the saved part UUID

### Stage 3: Assembly (Playwright)

Using the `parts-builder-playwright` skill:
1. Create a new assembly named after the robot
2. Place the mount part (root instance)
3. Place the Motor Case — snap its `weld` socket to mount's `weld` socket
4. Place the orobot Motor — snap `motor-socket` male to Motor Case's `motor-socket` female
5. Place the actuator part — snap `orobot-rotor` female to motor's `orobot-rotor` male
6. Set joint types in Inspector (revolute for actuator↔motor, fixed for structural)
7. Click Validate — verify no errors
8. Click Save
9. Screenshot the 3D canvas

Canonical part UUIDs:
- orobot Motor: `e33b1798-fdf5-4f0e-a8fd-b34669ca695d`
- Motor Case: `4f4539fe-30de-4be9-9150-aa35f5d9c09c`

### Stage 4: Code + Export

1. Generate program code from the spec (motor pin config, control script)
2. Create a program on orobot.io
3. Save script.js + config.json to the program
4. In Assembly Editor, click "Export to Program" → select the program → Export
5. Record program UUID and URL

### Stage 5: Scorecard

Evaluate the design against quality criteria: geometry correctness, socket compatibility, assembly integrity, and program functionality.

## Error Handling

- Spec unreadable → halt, print error.
- Part Designer fails → halt. Cannot proceed without part definitions.
- Playwright part creation fails → retry once (JSCAD may have a typo). If still broken, halt.
- Assembly fails → log, continue to scorecard. Scorecard will flag missing assembly.
- Code generation fails → log, continue (scorecard captures it).
- Export fails → log, continue to scorecard.

Never leave a dirty half-written file. Write to `foo.tmp` then rename on success.

## Prerequisites

- orobot.io running (production at https://orobot.io or local dev server)
- User logged in (session cookie present)
- Playwright MCP tools available
