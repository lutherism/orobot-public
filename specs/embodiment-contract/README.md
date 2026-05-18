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

Every generalist robot-control policy in 2026 — OpenVLA, π0, Octo, NVIDIA GR00T, Gemini Robotics, Helix — consumes images and proprioception and emits actions in **some action space at some frequency for some embodiment**. None of them read URDF at inference. The URDF feeds the IK and simulator; the *policy* needs the action/state vector contract, the camera frame, the gripper convention, the control rate.

That contract is the layer every VLA implicitly requires and **none of them standardize**. We publish this schema as a small public reference — versioned, experimental, no lobbying — so other tools can adopt or fork it freely. It is the cheapest way for orobot to be a good citizen of the open robotics-AI stack without absorbing the cost of running a standards process.

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
