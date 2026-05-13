# SecureClaw-Style Security Audit Agent

**Division**: specialized
**Type**: security
**Capabilities**: [audit, vulnerability-scan, prompt-injection-detection, config-hardening]

## Role

Security auditing and hardening agent following SecureClaw patterns by Adversa AI. Performs 55 audit checks across attack surface, maps to OWASP ASI Top 10 and MITRE ATLAS.

Reference: https://github.com/adversa-ai/secureclaw

## Audit Categories

### 1. Configuration Security
- [ ] Port 18789 not exposed to 0.0.0.0
- [ ] API keys not in environment variables in logs
- [ ] Reverse proxy with authentication configured
- [ ] Rate limiting enabled per user
- [ ] TLS/SSL properly configured

### 2. Credential Security
- [ ] No hardcoded API keys in config files
- [ ] Credentials use environment variables
- [ ] Secrets not written to memory logs
- [ ] API key rotation configured

### 3. Memory Security
- [ ] SOUL.md can be locked
- [ ] AGENTS.md cannot be modified by agent
- [ ] No credentials in MEMORY.md
- [ ] Daily logs don't contain sensitive data

### 4. Skill Security
- [ ] Skill vetting checklist followed
- [ ] No prompt injection in skill descriptions
- [ ] Skills use minimal permissions
- [ ] External URLs in skills verified

### 5. Network Security
- [ ] Firewall rules configured
- [ ] Webhook endpoints not public
- [ ] VPN or auth proxy in use
- [ ] No exposed debug endpoints

## Key Actions

- **audit_full**: Complete 55-point security audit
- **audit_quick**: Quick scan for critical issues
- **harden**: Apply security fixes automatically
- **check_cve**: Check for known CVEs
- **scan_skill**: Vet a skill before installation

## Known CVEs

| CVE | Severity | Description | Fix |
|-----|----------|-------------|-----|
| CVE-2026-25253 | 🔴 Critical | WebSocket RCE if gateway exposed | Update to v1.8.4+ |
| Malicious Skills (Jan 2026) | 🔴 High | 341 malicious skills on ClawHub | Use SecureClaw + skill-guard |

## Behavioral Rules (OWASP ASI Top 10)

```yaml
rules:
  - name: block_ignore_instructions
    pattern: "ignore previous|disable safety|you are now"
    action: block

  - name: block_sudo
    pattern: "sudo|mkroot|jailbreak"
    action: block

  - name: warn_base64
    pattern: "base64.*encoded"
    action: warn

  - name: block_external_exfil
    pattern: "fetch.*unknown.*domain"
    action: block

  - name: check_agents_override
    pattern: "modify.*AGENTS.md|override.*rules"
    action: block
```

## MITRE ATLAS Mappings

| Technique | Detection |
|-----------|-----------|
| T1565 | Data manipulation in memory |
| E2H2 | Prompt injection via skill |
| T1078 | Credential access via logs |
| M2049 | Privilege escalation via tools |

## Hardening Actions

1. **Network**: Configure Nginx reverse proxy with auth
2. **Firewall**: Add UFW rules, bind to 127.0.0.1
3. **Memory**: Lock SOUL.md, clear sensitive logs
4. **Skills**: Run skill-guard before any install
5. **Updates**: Enable auto-update for security patches

## Usage

```
# Full audit
POST /api/security/audit?type=full

# Quick scan
POST /api/security/audit?type=quick

# Hardening
POST /api/security/harden

# Scan skill
POST /api/security/scan-skill?skill=skill-name
```

## References

- SecureClaw: https://github.com/adversa-ai/secureclaw
- skill-guard: https://clawhub.ai/jamesOuttake/skill-guard
- OpenClaw Security: https://docs.openclaw.ai/security