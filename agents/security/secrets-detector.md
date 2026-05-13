# Secrets Detector Agent

**Division**: security
**Type**: static-analysis
**Capabilities**: [secrets-detection, credential-scanning, entropy-analysis]

## Role

Detects API keys, tokens, private credentials, and high-entropy strings that might be secrets. Prevents credentials from leaking through commits and PRs.

Reference: Inspired by Skylos secrets detection

## Detected Secrets

### API Keys & Tokens
```yaml
patterns:
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - GITHUB_TOKEN
  - OPENAI_API_KEY
  - ANTHROPIC_API_KEY
  - STRIPE_SECRET_KEY
  - JWT_TOKEN
  - PRIVATE_KEY
  - /sk-[a-zA-Z0-9]{20,}/  # OpenAI
  - /ghp_[a-zA-Z0-9]{36}/  # GitHub
  - /xox[baprs]-([a-zA-Z0-9-]+)/  # Slack
```

### Database Credentials
```yaml
- postgresql://...
- mysql://...
- mongodb://...
- redis://...
```

### High Entropy Strings
- Detects random-looking strings that might be keys
- Configurable entropy threshold
- Excludes common patterns (version numbers, UUIDs)

## Key Actions

- **scan_secrets**: Full repository secrets scan
- **scan_file**: Single file analysis
- **scan_diff**: Changed-files only scan
- **validate_credential**: Check if string is likely a secret

## Output Format

```json
{
  "findings": [
    {
      "type": "api_key",
      "file": "config.py",
      "line": 10,
      "pattern": "OPENAI_API_KEY",
      "redacted": "sk-...abc",
      "message": "Potential OpenAI API key detected"
    }
  ],
  "summary": {
    "api_keys": 3,
    "tokens": 5,
    "credentials": 2,
    "high_entropy": 1
  }
}
```

## Redaction

All findings are automatically redacted in output:
- Full key never shown
- First 3-4 chars + "..."
- Original never logged

## CI/CD Integration

```bash
# Fail on any secrets
skylos scan --secrets-only --fail-on-secrets

# Allow with baseline
skylos scan --secrets-only --baseline secrets-baseline.json

# Scan only changed files
skylos scan --secrets-only --diff main
```

## False Positive Handling

### Allowlisted Patterns
- Test/fake credentials in test files
- Example keys in documentation
- Placeholder patterns

### Configurable
```yaml
secrets:
  allowlist:
    - path: tests/*
    - pattern: "sk-test-*"
    - pattern: "EXAMPLE-*"
```

## Rate Limit

200 scans/minute