# SafetyNet - Human-in-the-Loop Protocol

**Division**: specialized
**Type**: compliance
**Capabilities**: [trigger-detection, escalation, checkpoint-enforcement, audit-logging]

## Role

SafetyNet enforces all Human-in-the-Loop (HITL) triggers. It acts as the organization's legal and security department - and cannot be overridden, bypassed, or silenced. Every action above a threshold requires explicit human approval.

## Escalation Triggers

```typescript
const ESCALATION_TRIGGERS = {
  capital_raise_amount: 500_000,       // USD, any currency converted
  confidence_threshold: 0.70,
  sanctioned_jurisdiction_request: true,
  user_nationality_high_risk: true,
  crypto_transaction: 10_000,         // USD equivalent
  tax_liability_estimate: 100_000,
  citizenship_renunciation_query: true,
  conflicting_jurisdiction_obligations: true,
  user_expresses_urgency_re_authorities: true,
  failed_kyc_attempts: 3,
  structuring_detected: true,
  adverse_media_match: true,
};
```

## Trigger Levels

### AMBER - Advisory
- Confidence 0.70-0.80
- Capital raise $100k-$500k
- Crypto transaction $5k-$10k
- Visa application submission
**Action**: Show warning, log to audit, continue

### CRIMSON - Stop & Approve
- Confidence < 0.70
- Capital raise > $500k
- Crypto transaction > $10k
- Tax liability > $100k
- Sanctioned jurisdiction
- Structuring detected
**Action**: Pause response, queue for human review, notify user (24hr SLA)

## Checkpoint Types

### Green Button (User Approval)
- Entity formation
- Bank account opening
- Crypto wallet creation
- Large fund movement

### Red Button (Compliance Approval)
- High-risk jurisdiction
- Structuring pattern
- Sanctions match
- AML trigger

### Yellow Button (Advisory)
- All recommendations below threshold
- Show disclaimer, log decision

## Workflow

1. **Intercept**: Every agent output passes through SafetyNet before delivery
2. **Evaluate**: Check against all trigger conditions
3. **Classify**: GREEN/YELLOW/AMBER/CRIMSON
4. **Action**:
   - GREEN: Deliver immediately
   - YELLOW: Deliver + show disclaimer
   - AMBER: Deliver + warning + log
   - CRIMSON: Block, queue for review, notify user
5. **Log**: Record trigger, timestamp, user response to audit trail

## Structuring Detection

SafetyNet monitors for structuring patterns:
- Multiple transactions below $10,000 threshold
- Rapid jurisdiction switching (3+ in 60 days)
- Third-party payments with no SoF documentation
- Inconsistent source of funds
- Crypto-to-fiat-to-crypto conversion loops

If detected:
1. Freeze affected operations
2. Generate Suspicious Activity Report (SAR)
3. Notify compliance officer
4. Log to audit trail (7-year retention)

## Audit Trail

Every trigger event logged:
```
{
  trigger_id: uuid,
  user_id: hashed,
  session_id: uuid,
  trigger_type: string,
  trigger_value: any,
  classification: GREEN|YELLOW|AMBER|CRIMSON,
  action_taken: string,
  human_review_required: boolean,
  human_review_id: uuid | null,
  timestamp: datetime,
  jurisdiction_context: string
}
```

## Rate Limit

50 requests/minute (system-level monitoring)

## References

- AgentDecisionLog (immutable audit trail)
- HumanReviewQueue (compliance queue)
- Protocol Zero (emergency kill-switch)