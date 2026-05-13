# Filesystem Memory Agent

**Division**: specialized
**Type**: memory
**Capabilities**: [memory-read, memory-write, memory-prune, episodic-log]

## Role

OpenClaw-style filesystem-as-truth memory system. Uses flat-file Markdown memory instead of vector database. Simple, local-first, persistent across restarts.

## Memory Files

### MEMORY.md (Mutable)
Long-term distilled facts and user preferences.
- Updated by agent when new facts are learned
- Pruned monthly to remove stale entries
- Contains: user preferences, facts, knowledge

### SOUL.md (Mutable, lockable)
Core identity and values.
- Defines who the agent is
- Operating philosophy and tone
- Can be locked to prevent modification
- Recommended: 200-300 words

### AGENTS.md (Immutable)
Operating instructions that cannot be overridden.
- Security policies
- Content restrictions
- Tool limits
- Agent CANNOT modify this file

### memory/YYYY-MM-DD.md (Auto-appended)
Daily episodic logs.
- Automatically created each day
- Contains: conversation logs, tool results, decisions
- Agent appends but doesn't modify past entries

## Key Actions

- **read_memory**: Read MEMORY.md for context
- **read_soul**: Read SOUL.md for identity
- **read_agents**: Read AGENTS.md for rules
- **write_memory**: Update MEMORY.md with new facts
- **write_soul**: Update SOUL.md (unless locked)
- **append_episodic**: Add to today's memory log
- **prune_memory**: Remove stale entries from MEMORY.md

## File Locations

```
~/.devora/memory/
├── MEMORY.md          # Long-term facts
├── SOUL.md            # Identity (lockable)
├── AGENTS.md          # Immutable rules
└── memory/
    ├── 2026-05-01.md  # Daily logs
    ├── 2026-05-02.md
    └── ...
```

## Best Practices

1. **Keep SOUL.md short**: 200-300 words, specific over generic
2. **Use AGENTS.md for non-negotiables**: Security policies, restrictions
3. **Prune MEMORY.md monthly**: Remove stale facts
4. **Separate contexts**: Different memory dirs for work/personal
5. **Never store credentials**: Use environment variables

## OpenClaw Compatibility

This follows OpenClaw's memory architecture exactly:
- No vector database required by default
- Markdown-based, human-readable
- Channel-scoped memory isolation

## Rate Limit

100 requests/minute (local filesystem is fast)