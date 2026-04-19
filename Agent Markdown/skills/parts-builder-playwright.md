# parts-builder-playwright

Build robot assemblies through the Parts Builder UI using Playwright browser automation. All interactions go through the browser — no direct API calls.

## Golden Rule

**Browser is the only interface.** You see what a user sees. You click what a user clicks. If you can't do it through Playwright snapshot/click/type/key, you can't do it.

## Prerequisites

- orobot.io running (production at https://orobot.io or local dev server)
- User logged in (session cookie present)
- Playwright MCP tools available

## Navigation

```
browser_navigate → https://orobot.io/o/parts-builder
```

The Parts Builder landing page shows the assembly library. To create a new assembly or open the editor, you'll interact from here.

To open the **Assembly Editor** (where you build):
- Click "New Assembly" to start fresh, or
- Click an existing assembly card to edit it

The editor URL pattern: `/o/parts-builder/assembly/{uuid}` (new) or `/o/parts-builder/assembly/{uuid}/edit` (existing).

## Creating Parts (Part Editor)

The Part Editor is where new parts are defined — JSCAD source, parameters, and sockets.

### Navigate to Part Editor

```
browser_navigate → https://orobot.io/o/parts-builder/parts/new
```

For editing an existing part: `/o/parts-builder/parts/{uuid}`

### Fill Part Metadata

Three TextFields at the top in a row:

```
browser_snapshot  → find TextField with label "Name"
browser_click     → click it
browser_type      → type the part name

browser_snapshot  → find TextField with label "slug"
browser_click     → click it
browser_type      → type the slug (lowercase, hyphens, e.g. "lsf-lever-arm")

browser_snapshot  → find TextField with label "Category"
browser_click     → click it
browser_type      → type the category (wheels, brackets, motors, sensors, structural, devices, other)
```

### Edit JSCAD Source

The SourcePane is a code editor labeled "part.js (JSCAD)". It contains default source code.

```
browser_snapshot  → find the code editor area
browser_click     → click into the editor
browser_press_key → Control+a (select all existing code)
browser_type      → type or paste the new JSCAD source
```

**Important:** The code editor uses a specialized textarea, not a standard input. Use `browser_type` after selecting all — do not use `browser_fill_form`.

### Add Parameters

Parameters appear in a table below the source editor. The "Add parameter" button is above the table.

For each parameter:
```
browser_snapshot  → find "Add parameter" button
browser_click     → click it (adds a new empty row to the table)
browser_snapshot  → find the new row's fields
```

Fill each cell in the row:
- **Name**: TextField with `data-field="name"` — type the parameter name
- **Type**: Select with `data-field="type"` — choose `number` or `enum`
- **Min/Max/Step**: TextFields (for number type) — type values
- **Default**: TextField — type the default value
- **Unit**: TextField — type the unit (e.g. "mm")

### Add Sockets

Sockets appear in a table below parameters. The "Add socket" button is above the table.

For each socket:
```
browser_snapshot  → find "Add socket" button
browser_click     → click it (adds a new empty row)
browser_snapshot  → find the new row's fields
```

Fill each cell in the row:
- **ID**: TextField — type the socket id (e.g. "rotor-hub")
- **Position x,y,z**: Three TextFields side by side — type each coordinate
- **Socket faces**: ToggleButtonGroup for orientation — click the appropriate axis label (+X, -X, +Y, -Y, +Z, -Z)
- **Type**: TextField — type the socket type (e.g. "orobot-rotor", "weld", "motor-socket", "snap")
- **Gender**: Select — choose male, female, or genderless
- **Joints**: Multi-select — choose from fixed, revolute, sliding
- **Delete**: IconButton with aria-label="delete socket" (to remove a socket)

### Save the Part

```
browser_snapshot  → find "Save" button (disabled when name is empty)
browser_click     → click Save
```

After saving:
- The URL changes to `/o/parts-builder/parts/{uuid}/edit` — record the UUID from the URL
- The dirty indicator disappears from the title
- "Saved" text appears next to the button

### Verify 3D Preview

The right side of the Part Editor shows a live 3D preview rendered from the JSCAD source.

```
browser_take_screenshot → verify the part geometry rendered correctly
```

If the preview is empty or shows an error, the JSCAD source has a bug — fix and re-save.

## Page Layout (Assembly Editor)

```
┌─────────────────────────────────────────────────┐
│  Topbar: [name field] [Undo] [Redo] [Validate]  │
│          [Export to Program] [Save]              │
├──────────┬──────────────────────┬───────────────┤
│ Assembly │                      │   Inspector   │
│   Tree   │    3D Canvas         │   (details    │
│ (left)   │    (center)          │    panel)     │
│          │                      │   (right)     │
├──────────┴──────────────────────┴───────────────┤
│  Part Palette: [category tabs] [part tiles]      │
└─────────────────────────────────────────────────┘
```

## Core Workflow: Building an Assembly

### 1. Name the Assembly

The name field is in the Topbar.

```
browser_snapshot  → find the TextField with data-field="assembly-name"
browser_click     → click the name field (clear existing text first via triple-click or Ctrl+A)
browser_type      → type the assembly name
```

### 2. Add Parts from the Palette

The Part Palette is at the bottom of the editor. Parts are organized by category tabs.

**Switch category:**
```
browser_snapshot  → find the MUI Tab matching the category name
                    Categories: Wheels, Brackets, Motors, Sensors, Structural, Devices, My Parts
browser_click     → click the tab
```

**Select a part to place:**
```
browser_snapshot  → find tile with role="button" containing the part name (img alt text or caption)
browser_click     → click the tile
```

After clicking a tile, a **ghost preview** attaches to your cursor over the 3D canvas. The ghost follows mouse movement.

**Place the part:**
```
browser_click     → click on the 3D canvas area to place the part
```

- The **first part** placed becomes the root instance.
- Subsequent parts will **snap to available sockets** on existing parts when the ghost is near a compatible socket. The ghost highlights green when a valid snap is detected.
- Click to confirm placement at the snapped position.

**If placement doesn't snap where you want:**
- Move the mouse to different areas of the canvas near the target socket
- The snap system matches by socket type (male↔female or genderless↔genderless) and joint compatibility
- Take a screenshot (`browser_take_screenshot`) to see the current ghost position
- The snap resolver picks the closest compatible socket pair — if the ghost has multiple sockets, it may try to match the wrong one depending on cursor position. Hover from different angles to get the desired socket pair.
- A **red tooltip** like "Socket type mismatch — you need a X socket" means the closest socket pair is incompatible. Move the cursor to a different part of the target to trigger matching of a different socket.
- A **pink/green sphere** at a socket position indicates snap detection is active.

**Canvas interactions require `browser_run_code` for coordinate clicks:**
```
browser_run_code → async (page) => {
  const canvas = page.locator('canvas');
  await canvas.hover({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(500);
  await canvas.click({ position: { x: 400, y: 300 } });
}
```

**Camera controls (via `browser_run_code`):**
- **Pan**: Right-click drag on canvas moves the camera
- **Rotate**: Left-click drag on canvas background rotates the view
- **Zoom**: Mouse wheel on canvas

**Avoid clicking on rotation gizmo rings** (red/green/blue circles around selected instances). These rotate the selected part, not the camera. If you accidentally drag one, undo with Ctrl+Z immediately.

**Cancel placement:**
```
browser_press_key → Escape
```

**Beforeunload dialogs:** The Part Editor and Assembly Editor show `onbeforeunload` dialogs when navigating away with unsaved changes. Use `browser_handle_dialog` with `accept: true` before navigating.

### 3. Select Instances in the Assembly Tree

The Assembly Tree is the floating panel on the top-left. Each node shows `{label} ({id})`.

```
browser_snapshot  → find the tree node by label text
browser_click     → click the node to select it
```

When empty, the tree shows: "Your assembly is empty — pick a part below to start building."

Selected nodes have `data-selected="true"`. Clicking the 3D canvas background or pressing Escape deselects.

### 4. Inspect and Modify (Inspector Panel)

The Inspector is the floating panel on the top-right. It shows details for the selected item.

**When an instance is selected:**
- Part name displayed at top
- **Parameters**: TextFields with `data-param="{paramName}"` — type new values to override defaults
- **Sockets**: Listed with free/used status
- **Action buttons**: "Re-snap", "Set as root", "Delete"

**Modify a parameter:**
```
browser_snapshot  → find the TextField with data-param matching the parameter name
browser_click     → click to focus
browser_fill_form → clear and type the new value
```

**When a meeting point (connection) is selected:**
- **Joint type**: native `<select>` — options: fixed, revolute, prismatic
- **Joint params**: TextFields with `data-joint-param="{paramName}"` (e.g. angle, offset)

**Change joint type:**
```
browser_snapshot  → find the select element for joint type
browser_select_option → choose the new joint type value
```

**Modify joint parameters:**
```
browser_snapshot  → find TextField with data-joint-param="angle" (or "offset")
browser_click     → click to focus
browser_fill_form → clear and type the new value
```

**Delete selected instance:**
```
browser_click     → click the "Delete" button in the Inspector
```
Or press the `Delete` key.

### 5. Save, Validate, Export

All in the Topbar.

**Save:**
```
browser_snapshot  → find "Save" button
browser_click     → click it
```
The unsaved indicator disappears after a successful save.

**Validate:**
```
browser_snapshot  → find "Validate" button
browser_click     → click it
```
Validation checks assembly integrity (connected graph, valid sockets, etc.).

**Export to Program:**
```
browser_snapshot  → find "Export to Program" button (disabled when assembly is empty)
browser_click     → click it
```
This creates a program from the assembly for use in the visual programmer.

### 6. Undo / Redo

Via Topbar buttons or keyboard:

```
browser_click     → click IconButton with aria-label="Undo"
browser_click     → click IconButton with aria-label="Redo"
```

Or:
```
browser_press_key → Control+z        (undo)
browser_press_key → Control+Shift+z  (redo)
```

## Keyboard Shortcuts Reference

| Key | Action |
|-----|--------|
| Escape | Deselect / cancel ghost placement |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Delete | Delete selected instance |

## Visual Verification

After each significant action (placing a part, snapping, modifying params), take a screenshot to verify the result:

```
browser_take_screenshot
```

Use `browser_snapshot` (accessibility tree) for finding elements to interact with. Use `browser_take_screenshot` (visual) for verifying spatial outcomes in the 3D view.

## Socket Snapping Details

Parts connect through typed sockets. The system enforces:
- **Gender matching**: male↔female or genderless↔genderless (same type required)
- **Type matching**: sockets must share a compatible type
- **Joint support**: the connection respects the joint types both sockets declare

When dragging a ghost near a compatible socket, the snap indicator turns green. If no snap appears, the sockets may be incompatible — try a different socket or a different part.

## Assembly Tree as Source of Truth

The Assembly Tree reflects the current state of the assembly. After placing parts and making connections:
- Each instance appears as a node
- Connections (meeting points) appear as child relationships
- The root instance is at the top

Use the tree to verify your assembly structure matches your intent.

## Troubleshooting

**Part tile not visible:** Switch category tabs — the part may be in a different category.

**Ghost won't snap:** The target socket may already be occupied, or the socket types are incompatible. Check the Inspector's socket list for "free" sockets on the target instance. The ghost tries to snap its closest socket to the target's closest free compatible socket — if the part has multiple sockets (e.g. Motor Case has `motor-socket` and `weld`), the wrong socket may be nearest. Approach from different angles.

**Ghost disappears without placing:** If you click on an existing assembly instance, the ghost gets dismissed and the instance gets selected instead. Ensure you click in empty canvas area near (but not on) the target, or click when the snap indicator (green/pink sphere) is visible.

**Can't find an element in snapshot:** The Playwright accessibility snapshot may not capture all elements cleanly. Try `browser_take_screenshot` to see the visual state, then click by coordinates if needed.

**3D canvas interactions:** The canvas is a WebGL surface. Playwright can click on it by coordinates but can't "see" 3D objects in the accessibility tree. Use screenshots to understand spatial layout, then use `browser_run_code` with `page.locator('canvas').click({ position: { x, y } })` for precise coordinate clicks.

**JSCAD preview timeout:** Parts using `params.*` will show "JSCAD evaluation exceeded 2s timeout" until the parameter is properly defined in the Parameters table with a default value. This is expected — the part will still save correctly.

## Example: Build a Simple Wheeled Base

```
1. browser_navigate → https://orobot.io/o/parts-builder
2. Click "New Assembly"
3. browser_fill_form → name it "Wheeled Base"
4. Switch to "Structural" tab in palette
5. Click a chassis/base part tile → click canvas to place (becomes root)
6. browser_take_screenshot → verify placement
7. Switch to "Wheels" tab
8. Click a wheel part tile → hover near chassis socket → click to snap
9. browser_take_screenshot → verify wheel attached
10. Repeat for remaining wheels
11. Select a meeting point in the tree → change joint type to "revolute" in Inspector
12. Click "Save"
13. Click "Validate" → verify no errors
```

## Orobot Socket Types

The orobot platform uses four canonical socket types for all robot assemblies:

| Socket Type | Genders | Joint Types | What It Connects |
|---|---|---|---|
| `motor-socket` | male / female | fixed | Motor body ↔ housing cavity |
| `orobot-rotor` | male / female | revolute, fixed | Motor output shaft ↔ driven part |
| `weld` | genderless | fixed | Two parts printed as one continuous body |
| `snap` | genderless | fixed | Dovetail interlock for large split bodies |

### Canonical Reference Parts (do not recreate)

| Part | UUID | Where to find |
|---|---|---|
| orobot Motor | `e33b1798-fdf5-4f0e-a8fd-b34669ca695d` | Motors category in palette |
| Motor Case | `4f4539fe-30de-4be9-9150-aa35f5d9c09c` | Structural category or My Parts |

## What NOT To Do

- **No fetch/XHR calls** to the API — everything through the browser UI
- **No direct state manipulation** — check state by reading the DOM (snapshot/screenshot)
- **No programmatic assembly construction** — build by clicking parts and placing them
- **No skipping the ghost placement step** — parts must be placed through the palette→canvas flow
