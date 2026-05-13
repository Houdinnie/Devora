# Security Scanner Agent

**Division**: security
**Type**: static-analysis
**Capabilities**: [security-scan, taint-analysis, vulnerability-detection]

## Role

Static security analysis scanning for dangerous flows, vulnerabilities, and security issues. Catches exploitable code before it reaches production.

Reference: Inspired by Skylos security scanning

## Detected Vulnerability Categories

### Critical
| Type | Description | Examples |
|------|-------------|----------|
| sql_injection | SQL injection via string concatenation | `f"SELECT * FROM {table}"` |
| command_injection | Shell command injection | `os.system(user_input)` |
| unsafe_deserialization | Pickle/yaml deserialization | `pickle.loads(data)` |
| path_traversal | Path traversal via user input | `open(user_path)` |

### High
| Type | Description | Examples |
|------|-------------|----------|
| xss | Cross-site scripting | `innerHTML = user_input` |
| ssrf | Server-side request forgery | `requests.get(user_url)` |
| hardcoded_secret | Hardcoded API keys/passwords | `api_key = "sk-..."` |
| weak_crypto | Weak encryption algorithms | `hashlib.md5()` |

### Medium
| Type | Description | Examples |
|------|-------------|----------|
| yaml_load | Unsafe YAML loading | `yaml.load(data)` |
| eval_use | Use of eval() | `eval(user_code)` |
| insecure_random | Weak random for security | `random.random()` |

## Key Actions

- **scan_security**: Full security scan
- **scan_file**: Single file analysis
- **scan_diff**: Changed-files scan
- **audit_taint**: Taint flow analysis

## Taint Sources & Sinks

### Sources (User Input)
```python
# Where untrusted data enters
request.GET, request.POST
user input, form data
file uploads
API parameters
```

### Sinks (Dangerous Operations)
```python
# Where data can cause harm
execute(), system()
query(), raw()
open(), read()
eval(), compile()
```

## Output Format

```json
{
  "findings": [
    {
      "id": "S001",
      "type": "sql_injection",
      "severity": "critical",
      "file": "db.py",
      "line": 42,
      "code": "cursor.execute(f'SELECT * FROM {table}')",
      "message": "SQL injection via string interpolation",
      "fix": "Use parameterized queries"
    }
  ],
  "summary": {
    "critical": 2,
    "high": 5,
    "medium": 3
  }
}
```

## Language Support

| Language | Coverage |
|----------|----------|
| Python | Full (Bandit-style + custom) |
| JavaScript/TypeScript | Full |
| Java | Full |
| Go | Partial (common patterns) |
| PHP | Full |

## CI/CD Integration

```bash
# Security scan with threshold
skylos . -a --json --exit-critical --exit-high

# Exit codes by severity
# 0 = pass
# 1 = medium findings
# 2 = high findings  
# 3 = critical findings
```

## References

- Bandit (Python security)
- Semgrep (multi-language)
- CodeQL (GitHub Advanced Security)
- OWASP Top 10