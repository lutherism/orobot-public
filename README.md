# orobot

CLI tool for the [orobot.io](https://orobot.io) robotics platform. Manage robots, devices, programs, and 3D print from the command line.

## Installation

```bash
npm install -g .
```

## Authentication

```bash
orobot login <email> <password>   # saves session locally
orobot logout
orobot me                         # show current user
```

Override the API endpoint with `--api http://localhost:8080` for local development.

## Commands

All commands output JSON. Add `--pretty` for readable formatting.

| Command | Description |
|---|---|
| `orobot devices list` | List your devices |
| `orobot devices get <uuid>` | Get device details |
| `orobot devices create <name> <uuid>` | Create a device |
| `orobot devices register <uuid>` | Register a device to your account |
| `orobot devices code-register <code>` | Register by short code |
| `orobot robots list` | List your robots |
| `orobot robots get <uuid>` | Get robot details |
| `orobot robots create <name> <programUuid>` | Create a robot |
| `orobot programs list` | List your programs |
| `orobot programs get <uuid>` | Get program details |
| `orobot programs create <name>` | Create a program |
| `orobot programs search <query>` | Search programs |
| `orobot programs publish <uuid>` | Publish to catalog |
| `orobot programs export <uuid>` | Export as zip |
| `orobot programs import <zipfile>` | Import from zip |
| `orobot emulator start <deviceUuid>` | Start device emulator |
| `orobot emulator stop <deviceUuid>` | Stop device emulator |
| `orobot users list` | List users |
| `orobot users get <uuid>` | Get user profile |
| `orobot comments list <programUuid>` | List program comments |
| `orobot comments post <programUuid> <text>` | Post a comment |
| `orobot files upload <path> <programUuid>` | Upload STL/photo |
| `orobot files download <url> <path>` | Download a file |

## 3D Printing

Print robots directly from orobot.io to a Moonraker-compatible 3D printer on your network.

```bash
orobot print connect                    # discover and connect to a printer
orobot print profiles                   # list slicer profiles
orobot print program <programUuid>      # download, slice, and print
orobot print register                   # register orobot:// URI scheme
```

Supports Cura and ideaMaker slicers. Run `orobot print setup` to configure slicer paths.

## License

MIT
