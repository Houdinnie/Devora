# Dead Code Detector Agent

**Division**: security
**Type**: static-analysis
**Capabilities**: [dead-code-detection, unused-functions, unused-imports, framework-awareness]

## Role

Framework-aware dead code detection. Finds unused functions, classes, imports, files, and framework entrypoint mistakes. Used as a PR gate to prevent dead code from merging.

Reference: Inspired by Skylos (v4.14.0)

## Supported Frameworks

### Python
- FastAPI route handlers, dependencies
- Django views, models, URLs
- Flask routes, blueprints
- pytest fixtures, tests
- SQLAlchemy models

### JavaScript/TypeScript
- Next.js pages, API routes, components
- React components, hooks
- Express routes
- Package entrypoints

### Other
- Java: Spring Boot, JUnit
- Go: functions, packages
- PHP: functions, classes

## Key Actions

- **scan_dead_code**: Full repository dead code scan
- **scan_file**: Single file dead code analysis
- **scan_diff**: Changed-files only scan (for PRs)
- **trace_runtime**: Use runtime traces to reduce false positives
- **baseline**: Set baseline to ignore legacy findings

## Detection Categories

| Category | Description | Examples |
|----------|-------------|----------|
| unused_function | Function never called | `def unused(): pass` |
| unused_class | Class never instantiated | `class Unused: pass` |
| unused_import | Import never used | `import os` (unused) |
| unused_variable | Variable assigned but never used | `x = 5` (never read) |
| dead_code | Unreachable code | `return` after `return` |
| framework_mistake | Framework-specific issues | pytest fixture never used |

## Configuration

```yaml
dead_code:
  min_confidence: 0.8
  include_tests: true
  framework_aware: true
  trace_enabled: false
  baseline: .skylos/baseline.json
  ignore:
    - path: tests/*
    - path: */migrations/*
    - pattern: __.*__
```

## Output Format

```json
{
  "findings": [
    {
      "type": "unused_function",
      "file": "src/utils.py",
      "line": 42,
      "name": "unused_helper",
      "confidence": 0.95,
      "message": "Function 'unused_helper' is never called"
    }
  ],
  "summary": {
    "total": 15,
    "unused_functions": 8,
    "unused_classes": 2,
    "unused_imports": 5
  }
}
```

## CI/CD Integration

```bash
# GitHub Actions
skylos scan . --json --output skylos-results.json

# Exit codes: 0=pass, 1=findings, 2=error
```

## Real-World Validation

Used in production PRs merged in:
- Black
- NetworkX
- Optuna
- mitmproxy
- pypdf
- beets
- Flagsmith

## Rate Limit

100 scans/minute

## References

- Skylos: https://github.com/duriantaco/skylos
- Vulture (Python dead code)
- ESLint (JS/TS unused)