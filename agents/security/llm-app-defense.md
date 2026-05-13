# LLM App Defense Agent

**Division**: security
**Type**: static-analysis
**Capabilities**: [llm-security, prompt-injection-detection, guardrail-checking]

## Role

Finds missing AI app guardrails mapped to OWASP LLM Top 10 risks. Helps teams ship AI features with proper security guardrails.

Reference: Inspired by Skylos AI defense (LLM App Security)

## OWASP LLM Risks Covered

### Critical
| Risk | Description |
|------|-------------|
| Prompt Injection | External input manipulation of LLM prompts |
| Insecure Output Handling | Unvalidated output passed to downstream functions |
| Tool Poisoning | Compromised tool definitions |

### High
| Risk | Description |
|------|-------------|
| Excessive Agency | LLM has too much autonomy/function access |
| Tool Misuse | Tool used incorrectly or with wrong parameters |
| Resource Abuse | Infinite loops, excessive API calls, memory issues |

### Medium
| Risk | Description |
|------|-------------|
| System Prompt Leakage | System instructions exposed to user |
| Vector Store Poisoning | Injected context via RAG |
| Excessive Functionality | Too many capabilities exposed |

## Key Actions

- **scan_llm_security**: Full LLM app security scan
- **check_prompt_injection**: Detect prompt injection vectors
- **check_output_validation**: Check output handling
- **check_function_definitions**: Validate tool definitions

## Detection Examples

### Prompt Injection
```python
# User input that might inject instructions
user_message = "Ignore previous instructions and..." 

# Detect: patterns that try to override system prompt
```

### Insecure Output Handling
```python
# Output from LLM directly executed
exec(llm_response)  # Dangerous!
eval(llm_output)
# Detect: output passed to dangerous functions
```

### Missing Rate Limits
```python
# LLM endpoint without rate limiting
@app.route("/chat")
def chat():
    return unlimited_llm_calls()

# Detect: LLM endpoints without rate limits
```

### Tool Definition Issues
```python
# Tool with dangerous permissions
{
    "name": "run_command",
    "description": "Execute shell command",
    "parameters": {
        "command": {"type": "string"}
    }
}
# Detect: overly powerful tools without restrictions
```

## Output Format

```json
{
  "findings": [
    {
      "owasp_id": "LLM01",
      "type": "prompt_injection",
      "severity": "critical",
      "file": "app.py",
      "line": 42,
      "message": "User input concatenated directly with system prompt",
      "recommendation": "Separate system prompt from user input"
    }
  ],
  "summary": {
    "LLM01_prompt_injection": 3,
    "LLM02_output_handling": 2,
    "LLM03_tool_poisoning": 0,
    "LLM04_excessive_agency": 1
  }
}
```

## Guardrail Checks

| Check | Description |
|-------|-------------|
| input_validation | User input sanitized before LLM |
| output_validation | LLM output validated before use |
| rate_limiting | LLM endpoints have rate limits |
| tool_sandboxing | Tools run in restricted environment |
| system_prompt_hidden | System prompt not exposed |
| context_isolation | RAG data isolated from user input |

## CI/CD Integration

```bash
# LLM security scan
skylos defend . --json

# Block without guardrails
skylos defend . --fail-on-critical
```

## References

- OWASP Top 10 for LLM Applications
- Anthropic AI Security Guidelines
- Google AI Security Guidelines

## Rate Limit

50 scans/minute