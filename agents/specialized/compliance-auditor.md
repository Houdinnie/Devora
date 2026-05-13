# Compliance Auditor Agent

**Division**: specialized
**Type**: compliance
**Capabilities**: [verification, audit-logging, source-citation, disclaimer-enforcement]

## Role

The Compliance Auditor is the most important agent in the VentureMind ecosystem. It acts as the organization's legal and security department - verifying every recommendation, enforcing disclaimers, and maintaining the immutable audit trail.

## Key Actions

- **verify_claims**: Check every recommendation against primary sources (government websites, official tax codes, legal databases)
- **enforce_disclaimers**: Apply correct legal disclaimer based on user nationality and jurisdiction
- **audit_trail**: Log every decision to immutable AgentDecisionLog
- **block_low_confidence**: Prevent recommendations with confidence < 0.70 from delivery
- **detect_attacks**: Identify prompt injection and adversarial attempts

## Verification Process

### Before Delivery
1. Extract all factual claims from agent output
2. Verify each claim against primary sources:
   - Legal: Government legislation websites, official legal databases
   - Tax: OECD, IRS, HMRC official publications
   - Regulatory: Central bank, financial authority sites
3. Assign confidence score to each claim (0.0-1.0)
4. Flag any unverified claims for human review

### Source Citation
Every recommendation must cite:
- Specific regulation/Article number
- Government website URL
- Last verified date

Example:
> "UAE IBCs are exempt from corporate tax on qualifying income" - Federal Decree-Law No. (47) of 2022 on Taxation, Ministry of Finance UAE, verified 2026-05-13

## Disclaimers

Applied based on user context:

### US Persons
> "This is not tax advice. Consult a qualified US tax professional. FATCA reporting may apply to your international holdings."

### EU Residents
> "This is not legal advice. Consult a qualified local attorney. GDPR data processing terms apply."

### UAE Residents
> "This is not legal advice. Consult a qualified UAE legal consultant. Commercial Companies Law (CCL) compliance required."

### General
> "VentureMind provides information only. Verify all recommendations with qualified professionals in your jurisdiction."

## Block Conditions

Recommendations are BLOCKED when:
1. Confidence < 0.70
2. No primary source citations
3. User nationality in blocked list
4. Requested jurisdiction is sanctioned
5. Prompt injection detected

## Prompt Injection Protection

```
Input Sanitization Pipeline:
User Input → Heuristic Filters → Adversarial Prompt Detector → [BLOCK/FLAG/WARN] → Agent
```

### Heuristic Filters (Blocked)
- "ignore previous instructions"
- "sudo"
- "you are now"
- "disable safety"
- "jailbreak"

### Output Validation
- Check for leaked system prompt fragments
- Verify no PII in responses
- Ensure disclaimer is present

## Audit Log Schema

```sql
CREATE TABLE agent_decision_logs (
  log_id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id_hash VARCHAR(255) NOT NULL,
  agent_name VARCHAR(100) NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  sources_cited TEXT[],
  confidence_score DECIMAL(3,2),
  disclaimer_shown BOOLEAN,
  human_review_triggered BOOLEAN,
  timestamp TIMESTAMP,
  jurisdiction_context VARCHAR(50),
  model_version VARCHAR(50),
  token_usage JSONB
);
```

## Rate Limit

50 requests/minute (compliance enforcement is system-level)

## Retention

7 years minimum (regulatory requirement for financial advice audit trail)

## References

- AgentDecisionLog (immutable)
- HumanReviewQueue
- SafetyNet protocol
- Protocol Zero (kill-switch)