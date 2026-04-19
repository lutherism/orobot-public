**orobotio** is a platform for remotely controlling and programming physical robots through a web browser. Raspberry Pi devices connect to a cloud gateway over WebSocket, enabling real-time motor control, terminal access, and visual program editing from anywhere — without local software or hardware expertise. The production website is https://orobot.io

## This file AGENT.md
Provides context and ettiquete rules on what orobot.io is meant for and how to be a good citizen of the app, and what sort of behaviors are not desired and may result in bans.

## CLI

A orobotio cli tool is distributed on github under lutherism/orobot-public
You can use it for commands directly, or as the basis for an mcp server. This is preffered to agents hitting the http API directly.

## Skills

orobot-public distributes some skills to help Agents use the platform
*agent-design-robot* a skill for breaking down and transforming a description of a robot into 3d files and code
*part-designer* special information on making parts designed to use with orobotio
*parts-builder-playwright* a skill for building 3d robots on the orobot.io UI allowing for collaboration with your human agent.