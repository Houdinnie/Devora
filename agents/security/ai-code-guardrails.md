# AI Code Guardrails Agent

**Division**: security
**Type**: static-analysis
**Capabilities**: [ai-detection, regression-detection, hallucination-catching]

## Role

Catches common AI-generated code mistakes, particularly during AI-assisted refactoring. Detects removed validation, auth, logging, rate limiting, and other controls that AI might accidentally strip.

Reference: Inspired by Skylos AI-code regression detection

## Detected Issues

### Authentication & Authorization
| Issue | Description |
|-------|-------------|
| removed_auth_check | Auth decorator/stub removed |
| fake_auth_kept | Fake auth helper left in production |
| missing_permission_check | Permission check stripped |

### Validation & Safety
| Issue | Description |
|-------|-------------|
| missing_input_validation | Input validation removed |
| disabled_validation | `if False:` wrapped validation |
| unchecked_null | Null check removed |

### Security Controls
| Issue | Description |
|-------|-------------|
| removed_rate_limit | Rate limiting stripped |
| missing_timeout | Network call without timeout |
| removed_csrf | CSRF protection removed |
| disabled_logging | Logging disabled |

### Code Quality
| Issue | Description |
|-------|-------------|
| phantom_stub | Stub function with no body |
| unfinished_impl | `...` or `pass` in implementation |
| copied_wrong | Copy-paste error from documentation |

## Key Actions

- **scan_ai_regressions**: Detect AI-caused regressions
- **check_code_quality**: Check for AI code quality issues
- **compare_baseline**: Compare against known-good baseline

## Pattern Detection

### Phantom Security Calls
```python
# AI might leave these but remove actual implementation
def verify_enterprise_auth(user):
    """Enterprise authentication."""
    pass  # Should check something!

# Detect: docstring implies work, but body is empty
```

### Missing Timeouts
```python
# AI often forgets timeouts on network calls
requests.get(url)  # No timeout!
httpx client calls without timeout

# Detect: network calls without timeout parameter
```

### Disabled Controls
```python
# AI might comment out or wrap in if False
#if False:
#    rate_limit()
# or
# def rate_limit(): pass  # TODO implement
```

## Configuration

```yaml
ai_guardrails:
  check_auth_removal: true
  check_validation_removal: true
  check_security_controls: true
  check_network_timeouts: true
  check_stubs: true

  # Project-specific terms to watch
  extra_phantom_names:
    - verify_enterprise_auth
    - tenant_admin_required
  extra_phantom_decorators:
    - tenant_admin_required
```

## Output Format

```json
{
  "findings": [
    {
      "type": "missing_timeout",
      "severity": "high",
      "file": "client.py",
      "line": 42,
      "code": "requests.get(url)",
      "message": "Network call missing timeout parameter",
      "suggestion": "Add timeout=30 parameter"
    }
  ],
  "summary": {
    "auth_removed": 2,
    "validation_removed": 1,
    "security_disabled": 3,
    "missing_timeouts": 5
  }
}
```

## CI/CD Integration

```bash
# AI regression scan in PR
skylos scan --ai-guardrails --diff main

# Block merges with high severity
skylos scan --ai-guardrails --exit-high
```

## Use Cases

1. **AI-assisted refactoring** - Detect accidentally removed controls
2. **Code review** - Catch AI-generated mistakes
3. **PR gates** - Prevent regression from merging
4. **Migration** - Detect issues during automated changes

## Rate Limit

100 scans/minute