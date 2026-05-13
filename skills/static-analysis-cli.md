# Skylos-Style Static Analysis CLI

**Category**: devtools
**Description**: CLI tool for static analysis - dead code, security, secrets, quality, and AI guardrails

## Installation

```bash
pip install skylos
# or
npm install -g skylos-js
```

## Quick Commands

```bash
# Dead code scan
skylos .

# Full audit (security + secrets + quality)
skylos . -a

# Changed-files only (for PRs)
skylos . --diff origin/main

# With runtime tracing (reduces false positives)
skylos . --trace
```

## Output Formats

| Format | Use Case |
|--------|----------|
| `--format json` | CI/CD, programmatic |
| `--format concise` | IDE output |
| `--format text` | Human-readable |
| `--format sarif` | GitHub annotations |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No findings |
| 1 | Low/medium findings |
| 2 | High findings |
| 3 | Critical findings |
| 4 | Error |

## Common Flags

| Flag | Description |
|------|-------------|
| `--json` | JSON output |
| `--output FILE` | Write to file |
| `--diff BRANCH` | Scan only changed files |
| `--trace` | Use runtime tracing |
| `--baseline FILE` | Use baseline file |
| `--exit-CRITICAL` | Exit code 3 on critical |
| `--ignore PATH` | Ignore path pattern |

## Devora Integration

This skill wraps Skylos patterns for Devora:
- Dead code detection
- Security vulnerability scanning
- Secrets detection
- AI code guardrails
- LLM app security

## Use in CI/CD

```yaml
# GitHub Actions
- name: Run Skylos
  run: skylos . -a --json --output results.json
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Configuration

Create `.skylos.yaml` or add to `pyproject.toml`:

```toml
[tool.skylos]
version = "1.0"
min_confidence = 0.8

[tool.skylos.security]
check_sql_injection = true
check_command_injection = true
check_xss = true

[tool.skylos.secrets]
entropy_threshold = 0.9

[tool.skylos.dead_code]
framework_aware = true
include_tests = false
```

## Real-World Results

Used in merged PRs for:
- Black
- NetworkX
- Optuna
- mitmproxy
- pypdf
- beets
- Flagsmith