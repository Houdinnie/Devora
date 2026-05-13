# Jurisdiction Engine

**Division**: specialized
**Type**: compliance
**Capabilities**: [jurisdiction-routing, regulatory-analysis, treaty-lookup]

## Role

The Jurisdiction Engine is the foundation of VentureMind's jurisdiction-first architecture. Every recommendation starts with the user's current country, goals, and capital profile. It determines which jurisdiction is optimal for the user's specific situation.

## Key Actions

- **analyze_profile**: Process user's nationality, location, income type, business model, goals
- **recommend_jurisdiction**: Rank jurisdictions by suitability score
- **compare**: Side-by-side comparison of 2+ jurisdictions
- **track_regulatory**: Monitor regulatory changes in recommended jurisdictions
- **substance_requirements**: Verify physical presence requirements for chosen jurisdiction

## Jurisdiction Database

The engine maintains profiles for 50+ jurisdictions:

### Zero-Tax / Low-Tax
- UAE (Dubai, Abu Dhabi, RAK, DIFC)
- Cayman Islands
- BVI
- Bermuda
- Isle of Man
- Jersey
- Guernsey
- Singapore
- Hong Kong

### Treaty Networks
- Netherlands
- Luxembourg
- Switzerland
- UK
- UAE (growing)

### Tax-Resident Options
- Portugal (NHR)
- Greece
- Italy (Flat tax)
- UAE (Golden Visa)
- Saudi Arabia

### High-Risk (Blocked)
- North Korea
- Iran
- Syria
- Cuba
- Crimea
- Russia (post-2022)

### High-Risk (Enhanced Due Diligence)
- Nigeria, Pakistan, Philippines, Kenya, Vietnam, South Africa (FATF grey-list)

## Scoring Algorithm

```
Jurisdiction Score = (
  tax_efficiency * 0.30 +
  legal_protection * 0.25 +
  banking_access * 0.20 +
  visa_options * 0.15 +
  regulatory_stability * 0.10
) - risk_penalty
```

Where:
- tax_efficiency: 0-100 (effective tax rate inverse)
- legal_protection: 0-100 (property rights, court system)
- banking_access: 0-100 (ease of account opening)
- visa_options: 0-100 (residency pathways)
- regulatory_stability: 0-100 (historical stability)
- risk_penalty: 0-50 (based on sanctions, FATF listing)

## SafetyNet Integration

The Jurisdiction Engine is the first check in the pipeline:
1. Block requests for sanctioned jurisdictions
2. Flag high-risk jurisdictions for enhanced due diligence
3. Log all jurisdiction recommendations to audit trail
4. Trigger human review for complex multi-jurisdiction structures

## Rate Limit

20 requests/minute (per user, fraud detection signal)

## References

- Feynman verification layer for regulatory claims
- Qdrant vector store for semantic jurisdiction search