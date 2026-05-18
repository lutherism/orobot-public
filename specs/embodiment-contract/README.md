# `embodiment.json` — the orobot embodiment contract

**Status:** `v0.1-experimental` — interface and field names may change without semver guarantees until `v1.0`.
**Maintainer:** orobot. **License:** same as the parent `orobot-public` repo.
**Support posture:** reference spec. No issue triage, no PR review SLA, no breakage-protection promises. Vendored, not supported.

---

## What this is

A small JSON document that describes the **control-side contract** of a robot embodiment: degrees of freedom, joint names, action and state spaces, control frequency, camera mounts, gripper convention, and the list of foundation-model / VLA stacks the embodiment is intended to plug into.

It is meant to ship **alongside** a URDF (and optionally an MJCF), inside an export bundle (`.orobot.zip`) emitted by orobot Parts Builder and any compatible tool.

```
robot.urdf            ← geometry, kinematics, dynamics (canonical)
robot.mjcf            ← auto-converted for MuJoCo / Isaac / GR00T / Newton
embodiment.json       ← THIS FILE: the control-side contract
assets/               ← meshes, textures
dataset_template/     ← empty LeRobot v3 dataset skeleton, pre-wired from embodiment.json
README.md             ← per-bundle assembly + fine-tune commands
```

## Why publish it

Neural policies are statistical learners. They consume continuous tensors (images, proprioceptive state vectors) and emit continuous tensors (joint targets, end-effector deltas). Discrete structured data like a URDF was never going to flow into a forward pass — kinematics are learned into the weights at training time, not read at inference. So "no VLA ingests URDF at inference" is trivially true by architecture, and is **not** the gap orobot fills.

The actual gap is upstream of the policy: **the operational contract between (a) the tools that create training datasets, (b) the adapter classes that translate a robot's raw sensor streams into network inputs and the network's outputs into motor commands, and (c) the policy runtime that owns the inference loop.** That contract — action space shape + dim + units + bounds, state channel structure, control frequency, camera intrinsics + URDF link mounts, gripper open/close convention, embodiment ID, joint name ordering — is required by every 2026 policy framework but standardized by none.

Two pieces of direct evidence:

- **Physical Intelligence's `openpi`** ships per-embodiment adapter classes that *hard-code joint sign flips and gripper remapping in Python* (e.g., `AlohaInputs` / `AlohaOutputs` with explicit `adapt_to_pi=True` branches). Every new robot requires hand-written Python before it can train or run.
- **NVIDIA GR00T** ships `modality.json` — a key→slice manifest over a flat state vector that the training pipeline consumes — plus a case-insensitive `--embodiment-tag` enum hand-mapped in a Python dict. `modality.json` is, by design, anemic: no joint limits, link lengths, kinematic tree, inertias, control frequency, camera intrinsics, or gripper convention. It proves the gap is real (NVIDIA tried to fill it) and that no cross-framework standard exists.

`embodiment.json` is what `modality.json` would be if it covered the full operational contract every policy framework needs and was shared across teams. It is consumed not by the policy network itself but by **dataset-creation tools, adapter-class instantiation, runtime control loops, fine-tune launchers, and simulator twins** — every box in the pipeline that today is glued together with hand-written Python.

We publish this schema as a small public reference — versioned, experimental, no lobbying — so other tools can adopt or fork it freely. It is the cheapest way for orobot to be a good citizen of the open robotics-AI stack without absorbing the cost of running a standards process.

### Evidence base — the per-embodiment adapter glue across major 2026 policies

The table below maps the **inference inputs** and the **location of per-embodiment hand-coding** across the major 2026 generalist policy frameworks. The pattern is consistent: every framework hand-codes the adapter / contract layer per (robot × framework) pair. There is no cross-framework standard for the contract that all of them implicitly require.

| Framework | Inference inputs to the policy network | Where the per-embodiment hand-coding lives | Citations | Confidence |
|---|---|---|---|---|
| OpenVLA / OpenVLA-OFT | RGB image + NL instruction; OFT adds proprio | `unnorm_key` string selects per-dataset action-normalization statistics (computed offline from demo action distributions); fine-tune adds a new head per new embodiment | [arXiv 2406.09246](https://arxiv.org/abs/2406.09246), [openvla GitHub](https://github.com/openvla/openvla), [OpenVLA-OFT site](https://openvla-oft.github.io/) | High |
| RT-X / Open X-Embodiment | Images + language; 7-D EE-pose action across 22 embodiments | **Zero explicit conditioning at the network** — embodiment inferred from visual context; per-dataset action de-norm applied *outside* the network at runtime | [arXiv 2310.08864](https://arxiv.org/abs/2310.08864) | High |
| Octo | RGB + (optional language or goal-image) + readout tokens | New embodiments add a new lightweight head + normalization stats (paper's "re-headable action space"); zero-pad missing camera channels; align gripper sign conventions per-dataset | [arXiv 2405.12213](https://arxiv.org/abs/2405.12213), [octo-models.github.io](https://octo-models.github.io/) | High |
| π0 / π0.5 (openpi) | Images dict + proprio `state` vector + tokenized prompt (`Observation` dataclass in `openpi/src/openpi/models/model.py`) | **Per-embodiment Python adapter classes** (`AlohaInputs` / `AlohaOutputs`, etc.) hard-code joint sign flips, gripper remapping, and zero-padding to a fixed trained-checkpoint `action_dim` (range 7–32 across published configs) | [π0 PDF](https://www.pi.website/download/pi0.pdf), [π0.5 PDF](https://www.pi.website/download/pi05.pdf), [openpi GitHub](https://github.com/Physical-Intelligence/openpi) | High |
| NVIDIA GR00T N1.x | Images + language + proprio `float32` state vector + `--embodiment-tag` string | `modality.json` (key→slice over flat state vector) + case-insensitive `--embodiment-tag` enum hand-mapped in `ENV_PREFIX_TO_EMBODIMENT_TAG` dict; URDF feeds Isaac Sim sim-twin authoring → synthetic data → per-embodiment MLP projector weights, then discarded | [arXiv 2503.14734](https://arxiv.org/abs/2503.14734), [Isaac-GR00T GitHub](https://github.com/NVIDIA/Isaac-GR00T) | High (0.92) |
| Gemini Robotics ER (1.5/1.6) | Text + image + video + audio → points / boxes / plans | Embodiment exposed as named `Tool` capability surface (`robot_run_instruction`, `robot_open_gripper` …) in the [gemini-robotics-sdk](https://github.com/google-deepmind/gemini-robotics-sdk) — runtime FastAPI registration, never a robot-description string | [arXiv 2510.03342](https://arxiv.org/abs/2510.03342), [Gemini Robotics overview](https://ai.google.dev/gemini-api/docs/robotics-overview) | High (0.90) |
| Gemini Robotics 1.5 VLA | Visual + language → motor commands (closed) | Motion Transfer mechanism is sold as *absence* of per-embodiment specialization; per-embodiment contract still required at the data-collection stage but unobservable in public docs | Same arXiv 2510.03342 | Medium-High (0.75) — paper body unread |
| Figure Helix | Monocular images + proprio (wrist pose + finger positions) + NL commands | Embodiment-locked to Figure 02 humanoid; adapter glue is internal and unpublished | [Figure Helix announcement](https://www.figure.ai/news/helix) | Medium (0.65) — single source |
| X-VLA (ICLR 2026) | Multi-view images + language + proprio (joint pos + EE pose) → 20-D action | Soft prompts `pi ≈ Φ(hi)` are *randomly initialized and learned implicitly through end-to-end training*; per-domain `meta.json` lists trajectory file paths; per-embodiment hand-coding lives in domain loader registration | [arXiv 2510.10274](https://arxiv.org/abs/2510.10274), [X-VLA GitHub](https://github.com/2toinf/X-VLA) | High |
| LeRobot v3 (dataset format) | n/a (data, not a policy) | Per-team Python schema for state dim, action dim, fps, camera streams, task description — implicit contract every consumer (OpenVLA, π0, Octo) must reverse-engineer per dataset | [LeRobotDataset v3 blog](https://huggingface.co/blog/lerobot-datasets-v3) | High |
| ALOHA / Mobile ALOHA | Wrist + egocentric camera RGB + arm joint positions → 14-D / 16-D action | **Not a generalist policy** — hardware platform + data convention (50 Hz, fixed camera layout) + per-task ACT/Diffusion-Policy baselines; listed for reference because it is the closest *de facto* convention to a contract today | [ALOHA PDF](https://tonyzhaozh.github.io/aloha/aloha.pdf), [Mobile ALOHA arXiv 2401.02117](https://arxiv.org/html/2401.02117v1) | High (reference) |

**Falsifier:** a published cross-framework standard that describes the operational contract — at minimum action space shape + dim + units + bounds, state channel structure, control frequency, camera intrinsics + URDF link mounts, gripper open/close convention, embodiment ID, and joint name ordering — consumed by at least two of the major 2026 policy frameworks (LeRobot, openpi, OpenVLA, Isaac-GR00T). If such a standard exists or ships, `embodiment.json`'s positioning needs revision — please file an issue with the citation.

**Provenance and correction history.** An earlier version of this spec made the narrower claim that "no 2026 VLA ingests URDF as direct input to the neural policy at inference." That claim is trivially true — neural networks do not consume discrete structured data as forward-pass inputs by architecture — and was a strawman that obscured the real gap. The current framing — that the dataset / adapter / runtime contract is hand-coded per (robot × framework) pair and lacks a cross-framework standard — was reached after critical review by the spec's author. Five independent LLM agents read primary sources in May 2026 (arXiv papers, model cards, the `openpi` `Observation` dataclass, the Isaac-GR00T `modality.json` and `--embodiment-tag` machinery, the `gemini-robotics-sdk` `embodiments/` directory, X-VLA's soft-prompt definition) to verify the original claim. Their findings are retained in the table because the data they gathered — per-model inputs, embodiment conditioning mechanisms, adapter-class locations — directly supports the corrected framing. Closed-weights models (Gemini VLA 1.5, Helix) carry necessarily lower confidence because internal architecture is hand-waved in public docs.

## What this is NOT

- **Not** a replacement for URDF or MJCF. Those are the geometry + dynamics layer. This is the control-contract layer above them.
- **Not** a training format. Trajectory data lives in [LeRobotDataset v3](https://huggingface.co/blog/lerobot-datasets-v3). `embodiment.json` describes the *shape* a dataset must conform to for this robot.
- **Not** a runtime API. The policy backend (OpenVLA inference server, π0 API, etc.) is a separate concern; `embodiment.json` tells the backend what shape of vector to emit.
- **Not** a robotics standards-body proposal. We are not pursuing adoption through formal channels.

## Schema (informal)

```jsonc
{
  "embodiment_id": "orobot.alex.gripper-arm-001",        // stable slug, globally unique
  "schema_version": "0.1.0",                              // this spec's version
  "frame_convention": "REP-103",                          // x-forward, z-up, right-handed
  "dof": 6,                                               // total degrees of freedom
  "joint_names": [                                        // ordered, must match URDF joint order used by IK
    "base_yaw", "shoulder_pitch", "elbow_pitch",
    "wrist_pitch", "wrist_roll", "gripper"
  ],
  "action_space": {
    "type": "joint_position",                             // joint_position | joint_velocity | ee_delta_pose | ee_absolute_pose
    "dim": 6,
    "units": ["rad", "rad", "rad", "rad", "rad", "normalized_01"],
    "bounds": [
      [-3.14, 3.14], [-1.57, 1.57], [-2.5, 2.5],
      [-1.57, 1.57], [-3.14, 3.14], [0.0, 1.0]
    ]
  },
  "state_space": {
    "channels": [
      { "name": "joint_pos", "dim": 6, "units": ["rad", "rad", "rad", "rad", "rad", "normalized_01"] },
      { "name": "joint_vel", "dim": 6, "units": "rad/s" },
      { "name": "joint_effort", "dim": 6, "units": "Nm" }
    ]
  },
  "control_hz": 30,                                       // nominal command rate
  "cameras": [
    {
      "name": "wrist_cam",
      "link": "wrist_link",                               // URDF link this camera is mounted on
      "width": 320, "height": 240,
      "fx": 200.0, "fy": 200.0, "cx": 160.0, "cy": 120.0,
      "hz": 30
    }
  ],
  "gripper": {
    "type": "parallel",                                   // parallel | suction | none
    "open": 1.0,                                          // value of the gripper action that means fully open
    "close": 0.0
  },
  "compatible_policies": [
    "openvla", "pi0", "octo", "gr00t-projector", "gemini-er-tool"
  ]
}
```

The machine-readable JSON Schema is in [`embodiment.schema.json`](./embodiment.schema.json). A concrete example is in [`example.embodiment.json`](./example.embodiment.json).

## Compatibility notes

- **OpenVLA / OpenVLA-OFT:** action_space typically `ee_delta_pose` (7-D, includes gripper). LoRA fine-tune from LeRobot v3 demos.
- **π0 / π0.5 (openpi):** action_space `joint_position` flow-matched chunks at 50 Hz. Zero-pads internally to 18-D; ≤ 18-DoF robots work directly.
- **Octo:** designed to be re-headed onto new observation + action spaces during fine-tune.
- **NVIDIA GR00T N1.x:** uses embodiment tags + per-robot MLP projector trained on a dataset; URDF (or our MJCF auto-conversion) feeds Isaac Lab synthetic data generation.
- **Gemini Robotics ER:** consumes images + language, emits points/plans/bounding boxes; orobot supplies its own IK against the URDF. Compatibility marker is `gemini-er-tool`.

These notes will go stale faster than the schema. They are guidance, not part of the contract.

## Versioning policy

- `0.x.y` — anything may change. Pin a commit hash, not a version.
- `1.x.y` — once we ship orobot Parts Builder v0 publicly, the schema goes to `1.0.0` and we adopt semver for breaking field changes only. Field additions are non-breaking.
- We do **not** promise to maintain backwards compatibility for `0.x.y` consumers.

## Pinning + citing this spec

```text
orobot embodiment contract, v0.1-experimental,
  https://github.com/lutherism/orobot-public/tree/<commit-hash>/specs/embodiment-contract/
```

Pin a commit. Do not rely on `main` being stable.

## License

Same as the parent `orobot-public` repo — see [`../../LICENSE`](../../LICENSE). The schema, examples, and this README are provided as-is, without warranty.

## A note on what this represents

orobot bets the company on a future where regular people compose robot bodies in a browser and AI control policies — written by other people, trained on hyperscale GPU clusters we do not own — bring those bodies to life. That bet only works if the control-contract layer is open. We publish this so the contract belongs to whoever uses it. We are loyal to all of humanity. We empower individuals as autonomous nodes in a collective. We do not believe the future of embodied intelligence should live behind any one company's gate — including ours.
