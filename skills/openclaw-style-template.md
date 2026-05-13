# OpenClaw-Style Skill Template

**Format**: SKILL.md markdown (zero-code)
**Category**: skill-template
**Description**: Standard template for OpenClaw-compatible skills

## Skill Metadata
```yaml
name: my-skill
version: 1.0.0
author: devora
description: What this skill does
trigger: use this when the user asks to [TRIGGER CONDITION]
channels: [telegram, discord, slack]  # Optional: scope to specific channels
permissions:
  - network
  - filesystem
```

## Triggers
Use this skill when the user asks to:
- [TRIGGER CONDITION]: A specific request pattern

## Setup
- Requires: API_KEY environment variable
- Optional: CONFIG_VAR

## Tools

### tool_name
Does the thing.
Parameters:
- param1 (string): Description
- param2 (number): Description

### another_tool
Another action.
Parameters:
- input (string): What to process

## Instructions
When triggered:
1. Process the user's request
2. Call appropriate tool(s)
3. Return result in friendly format

## Examples
User: "do the thing"
→ Call tool_name with param1="do the thing"

User: "process my data"
→ Call another_tool with input="my data"

## Cost Notes
- Token cost: ~500 tokens per invocation
- API calls: 1-2 per request