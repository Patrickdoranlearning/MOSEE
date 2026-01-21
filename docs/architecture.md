# MOSEE System Architecture

## Overview

MOSEE is designed as a modular system where each component handles a specific aspect of investment analysis. Data flows from raw financial statements through multiple analysis layers to produce intelligent investment recommendations.

## System Architecture Diagram

```mermaid
flowchart TB
    subgraph input [Data Input Layer]
        YF[yfinance API]
        FX[Forex Data]
        TICK[Ticker List]
    end
    
    subgraph extraction [Data Extraction]
        BS[Balance Sheet]
        IS[Income Statement]
        CF[Cash Flow]
        MKT[Market Data]
    end
    
    subgraph intelligence [MOSEE Intelligence Engine]
        subgraph books [Investment Book Metrics]
            GRAHAM[Graham Metrics]
            BUFFETT[Buffett/Munger]
            LYNCH[Lynch Metrics]
            GREENBLATT[Magic Formula]
            FISHER[Fisher Growth]
        end
        
        subgraph valuation [Range-Based Valuation]
            CONS[Conservative Value]
            BASE[Base Value]
            OPT[Optimistic Value]
        end
        
        subgraph quality [Quality Assessment]
            QSCORE[Quality Score]
            COMPOSITE[Composite Score]
        end
    end
    
    subgraph output [Intelligence Output]
        MOS[Margin of Safety Check]
        VERDICT[Investment Verdict]
        REPORT[Intelligence Report]
    end
    
    input --> extraction
    extraction --> intelligence
    books --> valuation
    books --> quality
    valuation --> MOS
    quality --> MOS
    MOS --> VERDICT
    VERDICT --> REPORT
```

## File Structure

```
MOSEE/
├── __init__.py                 # Main package exports
├── MOS.py                      # Core margin of safety calculations
├── confidence.py               # Data quality scoring
├── filters.py                  # Stock filtering
├── profile.py                  # Investment profile building
├── history.py                  # Historical tracking
├── valuation_range.py          # Range-based valuations
├── mosee_intelligence.py       # Smart verdict engine
│
├── data_retrieval/
│   ├── fundamental_data.py     # Financial statement extraction
│   └── market_data.py          # Price and market cap data
│
├── fundamental_analysis/
│   ├── indicators.py           # Graham, Buffett, Lynch metrics
│   ├── valuation.py            # DCF, PAD, Book value
│   ├── magic_formula.py        # Greenblatt's formula
│   └── growth_metrics.py       # Fisher growth analysis
│
├── scoring/
│   └── composite_score.py      # Multi-factor scoring
│
└── outputs/
    ├── csv_export.py           # CSV output
    ├── pdf_report.py           # PDF reports
    └── terminal.py             # Terminal display
```

## Module Structure Diagram

```mermaid
flowchart TB
    subgraph mosee_root [MOSEE Package]
        INIT[__init__.py]
        MOS_PY[MOS.py - Core MoS]
        CONF[confidence.py]
        FILT[filters.py]
        PROF[profile.py]
        HIST[history.py]
        VAL_RANGE[valuation_range.py]
        INTEL[mosee_intelligence.py]
    end
    
    subgraph data_ret [data_retrieval/]
        FUND[fundamental_data.py]
        MARKET[market_data.py]
    end
    
    subgraph fund_analysis [fundamental_analysis/]
        IND[indicators.py]
        VAL[valuation.py]
        MAGIC[magic_formula.py]
        GROWTH[growth_metrics.py]
    end
    
    subgraph scoring_mod [scoring/]
        COMP[composite_score.py]
    end
    
    subgraph outputs_mod [outputs/]
        CSV[csv_export.py]
        PDF[pdf_report.py]
        TERM[terminal.py]
    end
    
    mosee_root --> data_ret
    mosee_root --> fund_analysis
    mosee_root --> scoring_mod
    mosee_root --> outputs_mod
```

## Data Flow

```mermaid
flowchart TB
    subgraph step1 [Step 1: Data Collection]
        T[Ticker] --> YF2[yfinance]
        YF2 --> RAW[Raw Financial Data]
    end
    
    subgraph step2 [Step 2: Metric Extraction]
        RAW --> BS2[Balance Sheet Dict]
        RAW --> IS2[Income Statement Dict]
        RAW --> CF2[Cash Flow Dict]
        
        BS2 --> DEBT[Debt Metrics]
        BS2 --> EQUITY[Equity Metrics]
        IS2 --> EBIT[EBIT/Revenue]
        CF2 --> OE[Owner Earnings]
    end
    
    subgraph step3 [Step 3: Book Intelligence]
        DEBT --> GRAHAM2[Graham Analysis]
        EQUITY --> BUFFETT2[Buffett Analysis]
        EBIT --> GREEN2[Greenblatt Analysis]
        OE --> LYNCH2[Lynch Analysis]
        
        GRAHAM2 --> SCORES[Individual Scores]
        BUFFETT2 --> SCORES
        GREEN2 --> SCORES
        LYNCH2 --> SCORES
    end
    
    subgraph step4 [Step 4: Valuation Range]
        SCORES --> QUALITY2[Quality Score]
        QUALITY2 --> FAIR[Quality-Adjusted Fair Value]
        FAIR --> RANGE2[Valuation Range]
        
        RANGE2 --> C[Conservative]
        RANGE2 --> B[Base]
        RANGE2 --> O[Optimistic]
    end
    
    subgraph step5 [Step 5: MoS Gate]
        C --> MOS2{Price < Conservative × 0.7?}
        MOS2 -->|Yes| HAS_MOS[Has Margin of Safety]
        MOS2 -->|No| NO_MOS[No Margin of Safety]
    end
    
    subgraph step6 [Step 6: Verdict]
        HAS_MOS --> QUAL_CHECK{High Quality?}
        NO_MOS --> QUAL_CHECK2{High Quality?}
        
        QUAL_CHECK -->|Yes| SB[STRONG BUY]
        QUAL_CHECK -->|No| BC[BUY - Caution]
        QUAL_CHECK2 -->|Yes| WL[WATCHLIST]
        QUAL_CHECK2 -->|No| AV[AVOID]
    end
```

## Key Components

### 1. Data Retrieval Layer
- Downloads financial statements from yfinance (FREE)
- Handles currency conversion via forex_python
- Extracts and normalizes data fields

### 2. Fundamental Analysis Layer
- Calculates metrics from each investment philosophy
- Produces individual scores per methodology
- Handles missing data gracefully

### 3. Valuation Layer
- Creates range-based valuations (not single points)
- Adjusts for quality and predictability
- Triangulates multiple valuation methods

### 4. Intelligence Layer
- Combines all inputs into final verdict
- Enforces margin of safety requirement
- Generates actionable recommendations

### 5. Output Layer
- CSV exports for spreadsheet analysis
- PDF reports for presentation
- Terminal output for quick review
