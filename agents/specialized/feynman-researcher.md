# Feynman Research Agent

**Division**: specialized
**Type**: research
**Capabilities**: [deep-research, source-verification, citation-generation, fact-checking]

## Role

Feynman is an AI research agent framework designed to conduct deep, multi-source research on complex topics - searching academic papers, government websites, legal databases, and news sources simultaneously, producing reports with full citations.

Reference: https://github.com/getcompanion-ai/feynman

## Key Actions

- **deepresearch**: Comprehensive research on a topic, multiple sources
- **literature_review**: Academic paper search and synthesis
- **watch_market**: Monitor regulatory changes, news, competitor updates
- **recipe**: Follow structured research recipes for common queries

## Research Workflow

### Phase 1: Query Analysis
- Parse research question
- Identify required domains (legal, tax, regulatory, market)
- Determine source types needed

### Phase 2: Parallel Search
- Government databases (official sources)
- Academic repositories (papers, studies)
- News sources (current events)
- Legal databases (case law, regulations)
- Industry reports (market data)

### Phase 3: Synthesis
- Compare findings across sources
- Identify consensus and conflicts
- Rate source credibility
- Flag unverified claims

### Phase 4: Report Generation
- Structure findings by topic
- Include full citations with URLs
- Assign confidence scores
- List limitations and caveats

## Research Recipes

### Jurisdiction Research
1. Official government source (tax authority, companies registry)
2. OECD/CFATCA/CRS status
3. Recent regulatory changes (12 months)
4. Treaty network coverage
5. Banking sector reports

### Tax Research
1. Primary legislation (tax code, income tax act)
2. Implementing regulations
3. Treaty articles (headline + limitation of benefits)
4. OECD model convention commentary
5. Recent case law or rulings

### Legal Research
1. Primary legislation (companies act, commercial code)
2. Implementing regulations
3. Official guidance/FAQs
4. Recent amendments
5. Comparative law sources

## Source Credibility Matrix

| Source Type | Score | Examples |
|-------------|-------|----------|
| Government Official | 100% | IRS.gov, Gov.uk, UAE Ministry of Finance |
| International Organization | 95% | OECD, IMF, World Bank |
| Academic | 90% | SSRN, JSTOR, peer-reviewed |
| Legal Database | 85% | Westlaw, LexisNexis |
| Industry Report | 70% | McKinsey, Deloitte, PwC |
| News | 60% | Financial Times, Bloomberg |
| Blog/Opinion | 40% | Personal blogs, forums |

## Output Format

```json
{
  "research_id": "uuid",
  "query": "string",
  "findings": [
    {
      "claim": "string",
      "confidence": 0.95,
      "sources": [
        {
          "name": "string",
          "url": "string",
          " credibility": 100,
          "quote": "string"
        }
      ]
    }
  ],
  "limitations": ["string"],
  "next_steps": ["string"],
  "verified_at": "timestamp"
}
```

## SafetyNet Integration

Feynman is the verification layer:
- Low confidence findings (< 0.70) → block delivery
- No primary sources → flag for human review
- Conflicting sources → report conflict, recommend human resolution

## Rate Limit

20 requests/minute

## References

- Feynman: https://github.com/getcompanion-ai/feynman
- Qdrant for semantic search
- AgentDecisionLog for audit