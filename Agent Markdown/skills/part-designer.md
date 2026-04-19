# part-designer

Takes a robot spec and produces JSCAD part definition JSONs — one per robot-specific part. These JSONs match the Parts Builder part format and are consumed by Part Creation via Playwright.

## Input

- `spec` — a robot spec describing actuator type, mount surface, and dimensions

## Output

One JSON file per robot-specific part:

```json
{
  "name": "Light Switch Flipper — Mount",
  "slug": "lsf-mount",
  "category": "structural",
  "jscadSource": "const { cuboid, cylinder } = jscad.primitives; ...",
  "parameters": [
    { "name": "plateWidth", "type": "number", "default": 80, "min": 50, "max": 150, "step": 5, "unit": "mm" }
  ],
  "sockets": [
    { "id": "motor-attach", "position": ["0", "0", "thickness/2"], "orientation": [0,0,0,1],
      "type": "weld", "gender": "genderless", "supportedJoints": ["fixed"] }
  ]
}
```

## Canonical Socket Types

Only use these four types:

| Socket Type | Genders | Joint Types | Use For |
|---|---|---|---|
| `motor-socket` | male / female | fixed | Connecting to Motor Case housing |
| `orobot-rotor` | male / female | revolute, fixed | Connecting to motor output shaft |
| `weld` | genderless | fixed | Joining two parts that print as one body |
| `snap` | genderless | fixed | Joining large split bodies (>200mm) |

## Motor Constants

```javascript
const IN = 25.4;
const MOTOR_W = 2.25 * IN;   // 57.15mm — motor body width
const MOTOR_H = 2.00 * IN;   // 50.80mm — motor body height
const MOTOR_D = 3.00 * IN;   // 76.20mm — motor body depth
const ROTOR_SQ = (7/16) * IN; // 11.1125mm — rotor square shaft side
```

## Canonical Reference Parts (do NOT design these)

The pipeline reuses these existing Parts Builder parts by UUID:

- **orobot Motor** (`e33b1798-fdf5-4f0e-a8fd-b34669ca695d`) — the physical motor, `motor-socket` male + `orobot-rotor` male
- **Motor Case** (`4f4539fe-30de-4be9-9150-aa35f5d9c09c`) — printable housing, `motor-socket` female + `weld` genderless

Design only the **robot-specific** parts that connect to these.

## Required Parts by Actuator Type

| actuator_type | Parts to design | How they connect to canonical parts |
|---|---|---|
| lever-press | mount, lever arm | mount `weld`→ Motor Case `weld`; lever arm `orobot-rotor` female → orobot Motor `orobot-rotor` male |
| push-button | mount, push arm | mount `weld` → Motor Case `weld`; push arm `orobot-rotor` female → orobot Motor `orobot-rotor` male |
| rod-gripper | mount, gripper rotor | mount `weld` → Motor Case `weld`; gripper `orobot-rotor` female → orobot Motor `orobot-rotor` male |
| dial-turn | mount, dial adapter | mount `weld` → Motor Case `weld`; dial adapter `orobot-rotor` female → orobot Motor `orobot-rotor` male |
| continuous-rotation | mount, rotor attachment | mount `weld` → Motor Case `weld`; rotor `orobot-rotor` female → orobot Motor `orobot-rotor` male |

## JSCAD Authoring Rules

- Use `jscad.primitives` (cuboid, cylinder, sphere, etc.), `jscad.booleans` (union, subtract, intersect), `jscad.transforms` (translate, rotate, scale)
- Reference parameters via `params.paramName` — the Part Editor preview injects them at runtime
- Pin motor-interface dimensions as constants at the top, not parameters (these don't change)
- Leave 0.3–0.5mm clearance on press-fit interfaces for print tolerances
- Socket positions can use parameter expressions as strings (e.g. `"thickness/2"`) — the snap resolver evaluates them with the current parameter values

## Mount Surface Templates

Each `mount_surface` type has a standard attachment strategy:

| mount_surface | Attachment | Mount part shape |
|---|---|---|
| wall-flat | Adhesive pad or screw holes | Flat plate with Motor Case weld face on front |
| curtain-rod | Clamp halves around rod | C-clamp with rod bore, Motor Case weld on top |
| table-clamp | C-clamp on table edge | L-bracket with clamp jaw, Motor Case weld on vertical face |
| door-handle | Strap around handle | Wrap-around bracket, Motor Case weld on side |
| shelf-edge | Clip onto shelf lip | Hook bracket, Motor Case weld on top |

## Step-by-step Process

1. Read the spec
2. Identify required parts from the actuator type table
3. For each part:
   a. Determine the geometry based on actuator_type + mount_surface + max_dimensions_mm
   b. Write JSCAD source that creates the geometry using primitives and booleans
   c. Define parameters for dimensions the user might want to tune
   d. Define sockets using only canonical types, with positions/orientations that match the connection points
   e. Verify the bounding box fits within max_dimensions_mm
4. Save each part JSON
5. Verify files are valid JSON and JSCAD source is syntactically valid JavaScript
