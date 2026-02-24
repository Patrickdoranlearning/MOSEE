"""
Prompt Templates for MOSEE AI Annual Report Analysis

These prompts instruct Gemini 2.5 Flash to analyze 10-K filings
through the lens of value investing principles (Graham, Buffett,
Munger, Fisher, Lynch). The output is structured JSON for reliable
parsing and integration with MOSEE's scoring system.
"""

SYSTEM_PROMPT = """You are MOSEE's AI Analyst — an expert value investing analyst trained in the principles of Benjamin Graham, Warren Buffett, Charlie Munger, Philip Fisher, Peter Lynch, and Seth Klarman.

Your task is to analyze annual reports (10-K SEC filings) and provide a structured qualitative assessment. You read filings the way Buffett reads them: looking for honest management, durable competitive advantages, smart capital allocation, and hidden risks that numbers alone don't reveal.

## Your Analysis Framework

You evaluate companies across 8 dimensions, each scored 0-100:

1. **Management Quality** (0-100): Are they candid? Do they allocate capital well? Are incentives aligned with shareholders? Do they admit mistakes? Buffett says "We look for three things: intelligence, energy, and integrity."

2. **Competitive Moat** (0-100): How durable are the company's advantages? Pricing power, switching costs, network effects, cost advantages, intangible assets. Buffett: "The key to investing is determining the competitive advantage of any given company and, above all, the durability of that advantage."

3. **Capital Allocation** (0-100): How wisely does management deploy capital? Buybacks at fair prices? Disciplined M&A? Appropriate dividends? Munger: "The first rule of compounding: Never interrupt it unnecessarily."

4. **Risk Assessment** (0-100, where 100 = low risk): What are the key risks? Customer concentration, regulatory, technology disruption, leverage, cyclicality. Marks: "Risk means more things can happen than will happen."

5. **Growth Drivers** (0-100): What are the organic growth levers? TAM expansion, new markets, product pipeline. Fisher: "A company that grows largely through acquisition is a very different thing from one that grows organically."

6. **Accounting Quality** (0-100): Revenue recognition, off-balance-sheet items, non-GAAP adjustments, goodwill, related party transactions. Munger: "Show me the incentive and I will show you the outcome."

7. **Corporate Governance** (0-100): Board independence, executive compensation alignment, shareholder rights, related party issues.

8. **Strategic Consistency** (0-100): Year-over-year, does management do what they say? Do results match stated strategy? Do they change narrative to fit results?

## Scoring Guidelines

- **90-100**: Exceptional. Among the best you've seen. Clear evidence.
- **70-89**: Good. Above average with solid supporting evidence.
- **50-69**: Average. Nothing remarkable, no major concerns.
- **30-49**: Below average. Some concerns or lack of evidence.
- **0-29**: Poor. Significant red flags or actively concerning.

## Rules

- Base ALL assessments on evidence from the filing text. Cite specific quotes or data points.
- If a section is missing or lacks information for a dimension, give it a lower confidence score (0.0-1.0).
- Compare across the multiple years of filings when available — trends matter more than snapshots.
- Flag contradictions between what management says and what the numbers show.
- Be skeptical of overly promotional language. Buffett: "When management with a reputation for brilliance tackles a business with a reputation for bad economics, it is the reputation of the business that remains intact."
- Your output MUST be valid JSON matching the schema exactly."""

ANALYSIS_PROMPT_TEMPLATE = """## Company: {ticker} — {company_name}

## Quantitative Context (from MOSEE's analysis)
{metrics_summary}

## Investment Wisdom (from knowledge base)
The following excerpts from investment masters are relevant to this analysis:

{wisdom_context}

## Annual Report Filings

{filing_sections}

---

## Your Task

Analyze the above 10-K filing(s) for {ticker} and produce a structured assessment.

Respond with ONLY valid JSON matching this exact schema:

```json
{{
  "dimensions": [
    {{
      "name": "Management Quality",
      "score": <0-100>,
      "confidence": <0.0-1.0>,
      "summary": "<1-2 sentence assessment>",
      "evidence": ["<specific quote or data point from filing>", "..."]
    }},
    {{
      "name": "Competitive Moat",
      "score": <0-100>,
      "confidence": <0.0-1.0>,
      "summary": "<1-2 sentence assessment>",
      "evidence": ["<specific quote or data point>", "..."]
    }},
    {{
      "name": "Capital Allocation",
      "score": <0-100>,
      "confidence": <0.0-1.0>,
      "summary": "<1-2 sentence assessment>",
      "evidence": ["<specific quote or data point>", "..."]
    }},
    {{
      "name": "Risk Assessment",
      "score": <0-100>,
      "confidence": <0.0-1.0>,
      "summary": "<1-2 sentence assessment>",
      "evidence": ["<specific quote or data point>", "..."]
    }},
    {{
      "name": "Growth Drivers",
      "score": <0-100>,
      "confidence": <0.0-1.0>,
      "summary": "<1-2 sentence assessment>",
      "evidence": ["<specific quote or data point>", "..."]
    }},
    {{
      "name": "Accounting Quality",
      "score": <0-100>,
      "confidence": <0.0-1.0>,
      "summary": "<1-2 sentence assessment>",
      "evidence": ["<specific quote or data point>", "..."]
    }},
    {{
      "name": "Corporate Governance",
      "score": <0-100>,
      "confidence": <0.0-1.0>,
      "summary": "<1-2 sentence assessment>",
      "evidence": ["<specific quote or data point>", "..."]
    }},
    {{
      "name": "Strategic Consistency",
      "score": <0-100>,
      "confidence": <0.0-1.0>,
      "summary": "<1-2 sentence assessment>",
      "evidence": ["<specific quote or data point>", "..."]
    }}
  ],
  "executive_summary": "<3-5 sentence overall assessment of this company as an investment>",
  "key_findings": ["<most important discovery 1>", "<discovery 2>", "..."],
  "red_flags": ["<concern that numbers might miss 1>", "..."],
  "competitive_advantages": ["<moat identified 1>", "..."],
  "management_assessment": "<2-3 sentence overall assessment of management quality and character>"
}}
```

Important: Return ONLY the JSON object, no markdown code fences, no commentary."""


def build_metrics_summary(metrics: dict) -> str:
    """Build a concise summary of quantitative metrics for the AI prompt."""
    lines = []

    # Core valuation
    price = metrics.get('current_price', 'N/A')
    market_cap = metrics.get('market_cap', 0)
    if market_cap and market_cap > 0:
        cap_str = f"${market_cap / 1e9:.1f}B" if market_cap > 1e9 else f"${market_cap / 1e6:.0f}M"
    else:
        cap_str = "N/A"
    lines.append(f"Current Price: ${price} | Market Cap: {cap_str}")

    # Profitability
    roe = metrics.get('roe')
    roic = metrics.get('roic')
    if roe is not None:
        lines.append(f"ROE: {roe:.1%}" if isinstance(roe, float) else f"ROE: {roe}")
    if roic is not None:
        lines.append(f"ROIC: {roic:.1%}" if isinstance(roic, float) else f"ROIC: {roic}")

    # Valuation
    pe = metrics.get('pe_ratio')
    pb = metrics.get('pb_ratio')
    peg = metrics.get('peg_ratio')
    if pe is not None:
        lines.append(f"P/E: {pe:.1f}" if isinstance(pe, float) else f"P/E: {pe}")
    if pb is not None:
        lines.append(f"P/B: {pb:.1f}" if isinstance(pb, float) else f"P/B: {pb}")
    if peg is not None:
        lines.append(f"PEG: {peg:.2f}" if isinstance(peg, float) else f"PEG: {peg}")

    # Financial health
    dte = metrics.get('debt_to_equity')
    ic = metrics.get('interest_coverage')
    cr = metrics.get('current_ratio')
    if dte is not None:
        lines.append(f"Debt/Equity: {dte:.2f}" if isinstance(dte, float) else f"Debt/Equity: {dte}")
    if ic is not None:
        lines.append(f"Interest Coverage: {ic:.1f}x" if isinstance(ic, float) else f"Interest Coverage: {ic}")
    if cr is not None:
        lines.append(f"Current Ratio: {cr:.2f}" if isinstance(cr, float) else f"Current Ratio: {cr}")

    # Growth
    eg = metrics.get('earnings_growth')
    sg = metrics.get('sales_cagr')
    if eg is not None:
        lines.append(f"Earnings Growth: {eg:.1%}" if isinstance(eg, float) else f"Earnings Growth: {eg}")
    if sg is not None:
        lines.append(f"Sales CAGR: {sg:.1%}" if isinstance(sg, float) else f"Sales CAGR: {sg}")

    # Earnings classification
    ec = metrics.get('earnings_classification')
    if ec:
        lines.append(f"Earnings Pattern: {ec}")

    # Quality scores from MOSEE
    graham = metrics.get('graham_criteria_score')
    if graham is not None:
        lines.append(f"Graham Defensive Score: {graham}/7")

    return "\n".join(lines)


def build_filing_sections_text(filings: dict) -> str:
    """Format filing sections for the prompt."""
    sections_text = []

    for year in sorted(filings.keys(), reverse=True):
        annual = filings[year]
        sections_text.append(f"### Fiscal Year {year} (Filed: {annual.filing_date})")

        for section_key, section in annual.sections.items():
            # Truncate very long sections to stay within token budget
            text = section.text
            max_chars = 200_000  # ~50K tokens per section
            if len(text) > max_chars:
                text = text[:max_chars] + "\n\n[... section truncated for length ...]"

            sections_text.append(f"\n#### {section.title}\n\n{text}")

        sections_text.append("")  # Blank line between years

    return "\n".join(sections_text)


def build_analysis_prompt(
    ticker: str,
    company_name: str,
    metrics: dict,
    filings: dict,
    wisdom_chunks: list,
) -> str:
    """
    Build the complete analysis prompt for Gemini.

    Args:
        ticker: Stock symbol
        company_name: Full company name
        metrics: MOSEE all_metrics dict
        filings: Dict of year -> AnnualFiling
        wisdom_chunks: RAG-retrieved text chunks from knowledge base

    Returns:
        Formatted prompt string
    """
    metrics_summary = build_metrics_summary(metrics)
    filing_sections = build_filing_sections_text(filings)

    # Format wisdom context
    if wisdom_chunks:
        wisdom_context = "\n\n---\n\n".join(
            f"[Excerpt {i+1}]\n{chunk}" for i, chunk in enumerate(wisdom_chunks)
        )
    else:
        wisdom_context = "(No knowledge base available — analyze based on filing content and your investment knowledge.)"

    return ANALYSIS_PROMPT_TEMPLATE.format(
        ticker=ticker,
        company_name=company_name or ticker,
        metrics_summary=metrics_summary,
        wisdom_context=wisdom_context,
        filing_sections=filing_sections,
    )
