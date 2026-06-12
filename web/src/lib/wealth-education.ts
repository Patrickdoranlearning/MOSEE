/**
 * Wealth Education Registry — Books, Gurus & Teachings
 *
 * A single typed, hardcoded content registry powering the book/guru education
 * layer of the wealth-tree section. Teachings surface contextually inside each
 * wealth tool (keyed by `WealthTopic`) and on the 7-Cures spine (keyed by
 * `CureNumber`). This mirrors the proven `SEVEN_CURES` / `CURE_CONTENT` pattern:
 * content as code, fully type-checked, server-importable, zero infra.
 *
 * CONTENT HONESTY RULE (the confidence-honesty invariant applied to prose):
 *   - `attribution: 'quote'` is reserved for verbatim, genuinely attributable
 *     passages we are confident are real. These render with quote marks.
 *   - Everything reconstructed, condensed, or summarised is `'paraphrase'` and
 *     renders WITHOUT quote marks. When in doubt, paraphrase. No invented quotes.
 *
 * NOTE: No `'use client'` — this module is importable by server and client
 * components alike.
 */

import type { CureNumber } from '@/types/wealth-tree'

// ─── Types ──────────────────────────────────────────────────

/**
 * The 11 wealth-tool surfaces a teaching can attach to. These map onto the
 * tool pages (income, expenses, savings, debts, investments, net-worth, goals,
 * calculator, skills) and cross-cutting themes (compounding, risk, home).
 */
export type WealthTopic =
  | 'saving'
  | 'budgeting'
  | 'debt'
  | 'investing'
  | 'compounding'
  | 'risk'
  | 'income'
  | 'goals'
  | 'net-worth'
  | 'skills'
  | 'home'

export interface Book {
  id: string             // slug, e.g. 'intelligent-investor' — used in /learn/library/[book]
  title: string
  author: string
  guru: string           // display name, e.g. 'Benjamin Graham'
  year: number
  tagline: string        // one-line "why this book"
  coreIdeas: string[]    // 3-6 bullets for the library page
  moseeConnection: string // how it maps to MOSEE lenses / wealth-tree cures
}

export interface Teaching {
  id: string
  bookId: string                       // FK into BOOKS by id
  topics: WealthTopic[]                // where it surfaces
  cures: CureNumber[]                  // ties into 7-cures spine ([] allowed)
  text: string                         // the quote or paraphrased teaching
  attribution: 'quote' | 'paraphrase'  // honesty flag; paraphrases render without quote marks
  application: string                  // 1-2 sentences: what to DO in this MOSEE tool
}

// ─── Books ──────────────────────────────────────────────────

export const BOOKS: Book[] = [
  {
    id: 'richest-man-babylon',
    title: 'The Richest Man in Babylon',
    author: 'George S. Clason',
    guru: 'George S. Clason',
    year: 1926,
    tagline: 'The parable that gave us the 7 Cures — pay yourself first, in timeless form.',
    coreIdeas: [
      'A part of all you earn is yours to keep — save at least 10%.',
      'Control expenditures so desires never outrun income.',
      'Make your gold multiply by putting every coin to work.',
      'Guard your principal before chasing returns.',
      'Own your home and secure a future income.',
      'Increase your ability to earn through study and skill.',
    ],
    moseeConnection: 'The spine of the wealth-tree section. Its 7 Cures map directly onto the 7-cure tree tiers, and MOSEE’s margin-of-safety discipline is Cure 4 ("guard thy treasures") restated for stocks.',
  },
  {
    id: 'intelligent-investor',
    title: 'The Intelligent Investor',
    author: 'Benjamin Graham',
    guru: 'Benjamin Graham',
    year: 1949,
    tagline: 'The definitive text on value investing and the margin of safety.',
    coreIdeas: [
      'Margin of safety: buy well below intrinsic value so error and bad luck cannot ruin you.',
      'Mr. Market offers you prices daily — you are free to ignore him.',
      'Investing is most intelligent when it is most businesslike.',
      'Distinguish investment (safety of principal + adequate return) from speculation.',
      'The investor’s chief problem, and worst enemy, is likely to be himself.',
    ],
    moseeConnection: 'The direct ancestor of MOSEE’s margin-of-safety and Graham lens. Intrinsic value vs. price, and emotional discipline against Mr. Market, are the core of MOSEE’s valuation range and verdict logic.',
  },
  {
    id: 'buffett-letters',
    title: 'The Essays of Warren Buffett (Shareholder Letters)',
    author: 'Warren Buffett',
    guru: 'Warren Buffett',
    year: 1998,
    tagline: 'Decades of Berkshire letters distilled into a philosophy of owning great businesses.',
    coreIdeas: [
      'Rule No. 1: never lose money. Rule No. 2: never forget Rule No. 1.',
      'It is far better to buy a wonderful company at a fair price than a fair company at a wonderful price.',
      'Be fearful when others are greedy, and greedy when others are fearful.',
      'Our favorite holding period is forever.',
      'Risk comes from not knowing what you are doing.',
    ],
    moseeConnection: 'Buffett evolved Graham’s deep-value into quality-at-a-fair-price — the Buffett lens in MOSEE’s composite score. His "never lose money" rule is Cure 4 and MOSEE’s confidence/downside discipline.',
  },
  {
    id: 'poor-charlies-almanack',
    title: "Poor Charlie's Almanack",
    author: 'Charles T. Munger (ed. Peter Kaufman)',
    guru: 'Charlie Munger',
    year: 2005,
    tagline: 'Mental models, inversion, and worldly wisdom from Buffett’s partner.',
    coreIdeas: [
      'Invert, always invert — solve problems backward.',
      'Build a latticework of mental models from many disciplines.',
      'Avoid standard stupidities rather than seeking brilliance.',
      'Incentives drive behavior more than almost anything else.',
      'A great business at a fair price is superior to a fair business at a great price.',
    ],
    moseeConnection: 'Munger pushed Buffett toward quality and supplies MOSEE’s emphasis on avoiding errors (low-confidence verdicts) and inversion — asking what would make a thesis fail before buying.',
  },
  {
    id: 'one-up-wall-street',
    title: 'One Up on Wall Street',
    author: 'Peter Lynch',
    guru: 'Peter Lynch',
    year: 1989,
    tagline: 'How the everyday investor can beat the pros by knowing what they own.',
    coreIdeas: [
      'Invest in what you know — your edge is in businesses you understand.',
      'Know why you own a stock and have a one-sentence story for it.',
      'The P/E ratio relative to growth (PEG) tells you if you’re overpaying.',
      'Categorize companies (slow growers, stalwarts, fast growers, cyclicals).',
      'In the long run, earnings drive stock prices.',
    ],
    moseeConnection: 'Lynch’s growth-at-a-reasonable-price and PEG discipline are the Lynch lens in MOSEE’s composite score, and his "know your story" rule maps to writing down a goal/thesis.',
  },
  {
    id: 'common-stocks-uncommon-profits',
    title: 'Common Stocks and Uncommon Profits',
    author: 'Philip A. Fisher',
    guru: 'Philip A. Fisher',
    year: 1958,
    tagline: 'The growth-investing classic and the origin of "scuttlebutt" research.',
    coreIdeas: [
      'Use scuttlebutt: gather qualitative intelligence from customers, suppliers, competitors.',
      'Buy outstanding companies with durable growth and hold them for years.',
      'Superb management and a research culture matter more than this year’s margin.',
      'The right time to sell an outstanding stock is almost never.',
      'Concentrate in a few deeply-understood businesses rather than over-diversifying.',
    ],
    moseeConnection: 'Fisher’s qualitative scuttlebutt and long-horizon quality growth are the Fisher lens in MOSEE’s composite score and the rationale behind its scuttlebutt scoring.',
  },
  {
    id: 'little-book-beats-market',
    title: 'The Little Book That Beats the Market',
    author: 'Joel Greenblatt',
    guru: 'Joel Greenblatt',
    year: 2005,
    tagline: 'The "Magic Formula" — buy good companies at bargain prices, systematically.',
    coreIdeas: [
      'Rank by return on capital (good business) and earnings yield (cheap price).',
      'Buy a basket of the top-ranked names and hold with discipline.',
      'A systematic process protects you from your own emotions.',
      'Quality and cheapness together beat either one alone.',
      'Patience: the formula underperforms often enough to scare most people off.',
    ],
    moseeConnection: 'Greenblatt’s return-on-capital + earnings-yield ranking is the Greenblatt lens in MOSEE’s composite score — quality and value combined into a single ranking.',
  },
  {
    id: 'little-book-common-sense-investing',
    title: 'The Little Book of Common Sense Investing',
    author: 'John C. Bogle',
    guru: 'John Bogle',
    year: 2007,
    tagline: 'The case for low-cost index funds — own the whole market, keep your fees.',
    coreIdeas: [
      'Costs matter enormously: fees compound against you exactly as returns compound for you.',
      'Don’t look for the needle in the haystack — buy the haystack (the whole market).',
      'The more the financial system takes, the less the investor makes.',
      'Time is your friend; impulse is your enemy — stay the course.',
      'Most active managers fail to beat a low-cost index over time.',
    ],
    moseeConnection: 'Bogle is the humility baseline behind MOSEE: if your stock-picking can’t beat a low-cost index, default to indexing. The compound-growth calculator embodies his fees-and-time math.',
  },
]

// ─── Teachings ──────────────────────────────────────────────

export const TEACHINGS: Teaching[] = [
  // ── Babylon — saving (Cure 1) ──
  {
    id: 'babylon-pay-yourself-first',
    bookId: 'richest-man-babylon',
    topics: ['saving', 'income'],
    cures: [1],
    text: 'A part of all you earn is yours to keep. For every ten coins you place within your purse, take out for use but nine.',
    attribution: 'paraphrase',
    application: 'Set your savings-rate target to at least 10% and log each pay period so your actual rate is visible against it.',
  },
  {
    id: 'babylon-seed-account',
    bookId: 'richest-man-babylon',
    topics: ['saving', 'goals'],
    cures: [1],
    text: 'Treat the portion you keep as the seed of your wealth — never spend it, let it grow untouched until it labors for you.',
    attribution: 'paraphrase',
    application: 'Open a dedicated savings entry you never withdraw from, and watch the balance compound in the Savings tool.',
  },

  // ── Babylon — budgeting (Cure 2) ──
  {
    id: 'babylon-budget-expenses',
    bookId: 'richest-man-babylon',
    topics: ['budgeting'],
    cures: [2],
    text: 'Budget thy expenses that thou mayest have coins to pay for thy necessities, to pay for thy enjoyments and to gratify thy worthwhile desires without spending more than nine-tenths of thy earnings.',
    attribution: 'quote',
    application: 'Use the Expenses budget chart to keep total spending under 90% of income, with explicit category limits.',
  },
  {
    id: 'babylon-needs-vs-desires',
    bookId: 'richest-man-babylon',
    topics: ['budgeting'],
    cures: [2],
    text: 'What each calls his "necessary expenses" will always grow to equal his income unless he protests to the contrary. Confuse not the necessary expenses with thy desires.',
    attribution: 'paraphrase',
    application: 'Tag each expense as a need or a want, then find one "necessary" cost you can cut this month.',
  },

  // ── Babylon — home (Cure 5) ──
  {
    id: 'babylon-own-your-home',
    bookId: 'richest-man-babylon',
    topics: ['home', 'net-worth'],
    cures: [5],
    text: 'Own thy own home. Thus may he reduce his cost of living, and have more of his earnings available for pleasures and to build his growing wealth.',
    attribution: 'quote',
    application: 'Track your home in Investments and your mortgage in Debts so home equity flows into your net worth.',
  },

  // ── Babylon — income / future income (Cure 6) ──
  {
    id: 'babylon-future-income',
    bookId: 'richest-man-babylon',
    topics: ['income', 'goals'],
    cures: [6],
    text: 'Provide in advance for the needs of thy growing age and the protection of thy family.',
    attribution: 'paraphrase',
    application: 'Set a retirement goal and start funding a tax-advantaged account so future income is built before you need it.',
  },

  // ── Babylon — skills (Cure 7) ──
  {
    id: 'babylon-increase-earning',
    bookId: 'richest-man-babylon',
    topics: ['skills', 'income'],
    cures: [7],
    text: 'Cultivate thy own powers, study and become wiser, become more skillful, and so act as to respect thyself.',
    attribution: 'paraphrase',
    application: 'Log a skill or course in the Skills tool and the income increase you expect it to unlock.',
  },

  // ── Graham — investing / risk ──
  {
    id: 'graham-margin-of-safety',
    bookId: 'intelligent-investor',
    topics: ['investing', 'risk'],
    cures: [3, 4],
    text: 'Confronted with a challenge to distill the secret of sound investment into three words, we venture the motto: MARGIN OF SAFETY.',
    attribution: 'quote',
    application: 'Only buy when MOSEE’s valuation range puts price comfortably below the conservative estimate — that gap is your margin of safety.',
  },
  {
    id: 'graham-mr-market',
    bookId: 'intelligent-investor',
    topics: ['investing', 'risk'],
    cures: [4],
    text: 'Imagine that Mr. Market quotes you a price every day; you are free to buy from him, sell to him, or ignore him entirely. His moods are your opportunity, not your guide.',
    attribution: 'paraphrase',
    application: 'When a holding’s price swings, check it against your recorded thesis instead of reacting to the quote.',
  },
  {
    id: 'graham-investment-vs-speculation',
    bookId: 'intelligent-investor',
    topics: ['investing'],
    cures: [3, 4],
    text: 'An investment operation is one which, upon thorough analysis, promises safety of principal and an adequate return. Operations not meeting these requirements are speculative.',
    attribution: 'quote',
    application: 'Before adding a position, write the one analysis fact that makes it an investment, not a speculation.',
  },
  {
    id: 'graham-investor-worst-enemy',
    bookId: 'intelligent-investor',
    topics: ['risk', 'investing'],
    cures: [4],
    text: 'The investor’s chief problem, and even his worst enemy, is likely to be himself.',
    attribution: 'quote',
    application: 'Set goals and rules in advance so decisions are made calmly, not in the heat of a market move.',
  },

  // ── Buffett — risk / investing / saving ──
  {
    id: 'buffett-rule-no-1',
    bookId: 'buffett-letters',
    topics: ['risk', 'investing'],
    cures: [4],
    text: 'Rule No. 1: Never lose money. Rule No. 2: Never forget Rule No. 1.',
    attribution: 'quote',
    application: 'Build the emergency fund and avoid permanent loss first; protecting principal is the foundation everything else sits on.',
  },
  {
    id: 'buffett-wonderful-company',
    bookId: 'buffett-letters',
    topics: ['investing'],
    cures: [3],
    text: 'It is far better to buy a wonderful company at a fair price than a fair company at a wonderful price.',
    attribution: 'quote',
    application: 'Weight quality in your picks: a durable business at a reasonable MOSEE score beats a cheap, weak one.',
  },
  {
    id: 'buffett-fearful-greedy',
    bookId: 'buffett-letters',
    topics: ['investing', 'risk'],
    cures: [3, 4],
    text: 'Be fearful when others are greedy, and greedy when others are fearful.',
    attribution: 'quote',
    application: 'Use market panics to deploy savings into quality names, and trim enthusiasm when everyone is euphoric.',
  },
  {
    id: 'buffett-risk-not-knowing',
    bookId: 'buffett-letters',
    topics: ['risk', 'investing'],
    cures: [4],
    text: 'Risk comes from not knowing what you are doing.',
    attribution: 'quote',
    application: 'Stay inside your circle of competence; if you can’t explain the business simply, treat the position as higher risk.',
  },
  {
    id: 'buffett-holding-forever',
    bookId: 'buffett-letters',
    topics: ['investing', 'goals'],
    cures: [3, 6],
    text: 'Our favorite holding period is forever.',
    attribution: 'quote',
    application: 'Frame goals around long horizons so you let compounding, not trading, build the position.',
  },

  // ── Munger — investing / risk / skills ──
  {
    id: 'munger-invert',
    bookId: 'poor-charlies-almanack',
    topics: ['risk', 'goals'],
    cures: [4],
    text: 'Invert, always invert: many hard problems are best solved when they are addressed backward. (Munger borrowed this from the mathematician Carl Jacobi.)',
    attribution: 'paraphrase',
    application: 'For each goal, ask what would guarantee failure — then design around avoiding it.',
  },
  {
    id: 'munger-mental-models',
    bookId: 'poor-charlies-almanack',
    topics: ['investing', 'skills'],
    cures: [7],
    text: 'You need a latticework of mental models from many disciplines, and the wisdom to hang your experience on it.',
    attribution: 'paraphrase',
    application: 'Treat learning as portfolio diversification: invest in a few cross-disciplinary skills and log them in Skills.',
  },
  {
    id: 'munger-avoid-stupidity',
    bookId: 'poor-charlies-almanack',
    topics: ['risk', 'investing'],
    cures: [4],
    text: 'It is remarkable how much long-term advantage people like us have gotten by trying to be consistently not stupid, instead of trying to be very intelligent.',
    attribution: 'quote',
    application: 'Filter out obvious mistakes (overpaying, over-concentrating, high-fee products) before hunting for brilliance.',
  },
  {
    id: 'munger-incentives',
    bookId: 'poor-charlies-almanack',
    topics: ['budgeting', 'income'],
    cures: [2],
    text: 'Show me the incentive and I will show you the outcome. Never underestimate the power of incentives to shape behavior.',
    attribution: 'paraphrase',
    application: 'Automate savings and bill payments so good outcomes happen by default rather than relying on willpower.',
  },

  // ── Lynch — investing / goals / income ──
  {
    id: 'lynch-know-what-you-own',
    bookId: 'one-up-wall-street',
    topics: ['investing', 'goals'],
    cures: [3],
    text: 'Know what you own, and know why you own it.',
    attribution: 'paraphrase',
    application: 'For each holding, record a one-sentence story in your goals so you can defend it during a downturn.',
  },
  {
    id: 'lynch-invest-in-what-you-know',
    bookId: 'one-up-wall-street',
    topics: ['investing'],
    cures: [3],
    text: 'The everyday investor’s edge is in the businesses and products they already understand from daily life.',
    attribution: 'paraphrase',
    application: 'Start your watchlist from companies you genuinely understand, then let MOSEE check the numbers.',
  },
  {
    id: 'lynch-earnings-drive-prices',
    bookId: 'one-up-wall-street',
    topics: ['investing', 'compounding'],
    cures: [3],
    text: 'People may bet on quarterly wiggles, but in the long run it is earnings that move stock prices.',
    attribution: 'paraphrase',
    application: 'Favor companies whose earnings are growing; the calculator shows how compounding earnings drive long-run value.',
  },
  {
    id: 'lynch-peg-overpaying',
    bookId: 'one-up-wall-street',
    topics: ['investing'],
    cures: [3],
    text: 'The P/E ratio of any company fairly priced will roughly equal its growth rate — pay attention when price runs far ahead of growth.',
    attribution: 'paraphrase',
    application: 'Sanity-check a pick’s valuation against its growth rate before buying, exactly as MOSEE’s Lynch lens does.',
  },

  // ── Fisher — investing / skills / income ──
  {
    id: 'fisher-scuttlebutt',
    bookId: 'common-stocks-uncommon-profits',
    topics: ['investing', 'skills'],
    cures: [3, 7],
    text: 'Use the "scuttlebutt" method: a surprisingly accurate picture of a company emerges from talking to its customers, suppliers, competitors and former employees.',
    attribution: 'paraphrase',
    application: 'Add qualitative scuttlebutt notes to a stock before trusting the score alone — research is a skill worth building.',
  },
  {
    id: 'fisher-hold-outstanding',
    bookId: 'common-stocks-uncommon-profits',
    topics: ['investing', 'goals'],
    cures: [3, 6],
    text: 'If the job of buying an outstanding company has been done correctly, the time to sell is almost never.',
    attribution: 'paraphrase',
    application: 'Set long-hold goals for your highest-conviction names instead of trading around them.',
  },
  {
    id: 'fisher-quality-management',
    bookId: 'common-stocks-uncommon-profits',
    topics: ['investing', 'income'],
    cures: [3],
    text: 'Superb management and an ingrained research culture matter more to long-term returns than any single year’s margin.',
    attribution: 'paraphrase',
    application: 'When comparing picks, weigh management quality and reinvestment, not just the latest reported number.',
  },

  // ── Greenblatt — investing / compounding ──
  {
    id: 'greenblatt-magic-formula',
    bookId: 'little-book-beats-market',
    topics: ['investing'],
    cures: [3],
    text: 'Buy good companies (high return on capital) at bargain prices (high earnings yield), and let a disciplined ranking do the choosing.',
    attribution: 'paraphrase',
    application: 'Use MOSEE’s Greenblatt lens to combine quality and cheapness rather than scoring either in isolation.',
  },
  {
    id: 'greenblatt-process-over-emotion',
    bookId: 'little-book-beats-market',
    topics: ['investing', 'risk'],
    cures: [4],
    text: 'A systematic process is what protects you from your own emotions when the market gets loud.',
    attribution: 'paraphrase',
    application: 'Lean on your written rules and MOSEE’s rankings during volatility instead of improvising.',
  },
  {
    id: 'greenblatt-patience',
    bookId: 'little-book-beats-market',
    topics: ['compounding', 'goals'],
    cures: [3],
    text: 'The formula underperforms often enough, and for long enough, to scare most people off — which is exactly why patience is rewarded.',
    attribution: 'paraphrase',
    application: 'Hold to your plan through multi-year stretches of underperformance; the calculator shows what patience compounds into.',
  },

  // ── Bogle — compounding / saving / investing / net-worth ──
  {
    id: 'bogle-costs-matter',
    bookId: 'little-book-common-sense-investing',
    topics: ['compounding', 'investing'],
    cures: [3],
    text: 'The relentless rules of humble arithmetic: gross return in the market, minus the costs of investing, equals the net return investors actually share.',
    attribution: 'paraphrase',
    application: 'Prefer low-fee index funds; in the calculator, model how even a 1% fee erodes decades of compounding.',
  },
  {
    id: 'bogle-buy-the-haystack',
    bookId: 'little-book-common-sense-investing',
    topics: ['investing', 'risk'],
    cures: [3, 4],
    text: 'Don’t look for the needle in the haystack. Just buy the haystack.',
    attribution: 'quote',
    application: 'Use a broad low-cost index fund as your default core, and let MOSEE picks be the satellite, not the base.',
  },
  {
    id: 'bogle-stay-the-course',
    bookId: 'little-book-common-sense-investing',
    topics: ['compounding', 'saving'],
    cures: [1, 3],
    text: 'Time is your friend; impulse is your enemy. Stay the course.',
    attribution: 'paraphrase',
    application: 'Keep contributing automatically every month regardless of headlines; consistency beats timing.',
  },
  {
    id: 'bogle-net-worth-discipline',
    bookId: 'little-book-common-sense-investing',
    topics: ['net-worth', 'compounding'],
    cures: [3, 6],
    text: 'The miracle of compounding returns is overwhelmed over time by the tyranny of compounding costs — watch both sides of your net worth.',
    attribution: 'paraphrase',
    application: 'Snapshot your net worth regularly to see assets compounding and to keep fees and debt from quietly eroding it.',
  },

  // ── Graham — net-worth / saving (extra coverage) ──
  {
    id: 'graham-businesslike',
    bookId: 'intelligent-investor',
    topics: ['net-worth', 'goals'],
    cures: [3],
    text: 'Investing is most intelligent when it is most businesslike.',
    attribution: 'quote',
    application: 'Run your personal balance sheet like a business: track net worth, set targets, and review on a schedule.',
  },

  // ── Buffett — net-worth / saving (extra coverage) ──
  {
    id: 'buffett-spend-after-saving',
    bookId: 'buffett-letters',
    topics: ['saving', 'net-worth'],
    cures: [1],
    text: 'Do not save what is left after spending; instead spend what is left after saving.',
    attribution: 'paraphrase',
    application: 'Move your savings transfer to payday, before discretionary spending, and let net worth climb as a result.',
  },

  // ── Lynch — income / net-worth (extra coverage) ──
  {
    id: 'lynch-story-changes',
    bookId: 'one-up-wall-street',
    topics: ['income', 'net-worth'],
    cures: [6],
    text: 'Check the story periodically: a stock you bought for one reason should still hold up for that reason, or it’s time to reassess.',
    attribution: 'paraphrase',
    application: 'Revisit income-producing holdings when you snapshot net worth, and prune ones whose thesis has broken.',
  },

  // ── Munger — net-worth / compounding (extra coverage) ──
  {
    id: 'munger-first-100k',
    bookId: 'poor-charlies-almanack',
    topics: ['net-worth', 'compounding', 'saving'],
    cures: [1, 3],
    text: 'The first rule of compounding: never interrupt it unnecessarily. The hardest stretch is the early accumulation before momentum takes over.',
    attribution: 'paraphrase',
    application: 'Avoid dipping into invested capital; track net worth to stay motivated through the slow early build.',
  },

  // ── Greenblatt — net-worth (extra coverage) ──
  {
    id: 'greenblatt-good-and-cheap-networth',
    bookId: 'little-book-beats-market',
    topics: ['net-worth', 'investing'],
    cures: [3],
    text: 'Owning a basket of good businesses bought cheaply, and holding it, is how an ordinary balance sheet grows extraordinary over time.',
    attribution: 'paraphrase',
    application: 'Let quality holdings accumulate on your net-worth statement rather than trading them in and out.',
  },

  // ── Bogle — income / goals (extra coverage) ──
  {
    id: 'bogle-simplicity-goals',
    bookId: 'little-book-common-sense-investing',
    topics: ['goals', 'income'],
    cures: [6],
    text: 'Simplicity is the master key to financial success: a sound, low-cost, diversified plan held for decades outperforms cleverness.',
    attribution: 'paraphrase',
    application: 'Set a simple, automatic retirement-funding goal and leave it alone to do its work.',
  },

  // ── Fisher — skills (extra coverage) ──
  {
    id: 'fisher-continuous-learning',
    bookId: 'common-stocks-uncommon-profits',
    topics: ['skills'],
    cures: [7],
    text: 'The investor who keeps learning about industries and companies compounds an edge that no single tip can provide.',
    attribution: 'paraphrase',
    application: 'Budget time and money for ongoing learning and record each investment in the Skills tool.',
  },

  // ── Babylon — debt (Cure 4 / risk) ──
  {
    id: 'babylon-debt-relentless',
    bookId: 'richest-man-babylon',
    topics: ['debt', 'risk'],
    cures: [4],
    text: 'Where the determination is, the way can be found. Pay your debts with all the promptness within your power, sparing not to deny yourself, that you may the more quickly become free.',
    attribution: 'paraphrase',
    application: 'List every debt and attack the highest-interest balance first with the payoff calculator.',
  },

  // ── Buffett — debt (extra coverage) ──
  {
    id: 'buffett-avoid-leverage',
    bookId: 'buffett-letters',
    topics: ['debt', 'risk'],
    cures: [4],
    text: 'When you combine ignorance and borrowed money, the consequences can get interesting. Smart people have gone broke using leverage.',
    attribution: 'paraphrase',
    application: 'Pay down high-interest debt before adding risk; never invest with borrowed money you can’t afford to lose.',
  },

  // ── Bogle — debt (extra coverage) ──
  {
    id: 'bogle-debt-negative-compounding',
    bookId: 'little-book-common-sense-investing',
    topics: ['debt', 'compounding'],
    cures: [4],
    text: 'Compounding cuts both ways: high-interest debt grows against you with the same relentless arithmetic that grows investments for you.',
    attribution: 'paraphrase',
    application: 'Use the debt-payoff calculator to see the interest you save, and treat paying off a 20% card as a guaranteed 20% return.',
  },

  // ── Home / dwelling coverage (≥3 teachings, ≥2 books) ──
  {
    id: 'buffett-house-to-live-in',
    bookId: 'buffett-letters',
    topics: ['home', 'risk'],
    cures: [5],
    text: 'A home is for living in, financed sensibly — not a leveraged bet that house prices only ever rise.',
    attribution: 'paraphrase',
    application: 'Buy within your means and keep the mortgage conservative; track the home in Investments and the loan in Debts.',
  },
  {
    id: 'bogle-home-low-cost',
    bookId: 'little-book-common-sense-investing',
    topics: ['home', 'net-worth'],
    cures: [5],
    text: 'The same arithmetic that rewards low-cost investing rewards a sensibly-financed home: minimize the carrying costs and the equity is yours to keep.',
    attribution: 'paraphrase',
    application: 'Watch mortgage rate, taxes and fees as the "cost drag" on your home, and let paid-down equity lift net worth.',
  },
  {
    id: 'lynch-house-before-stocks',
    bookId: 'one-up-wall-street',
    topics: ['home', 'goals'],
    cures: [5],
    text: 'Before you buy a stock, think about buying a house — for most people a home is the one good leveraged investment they reliably make.',
    attribution: 'paraphrase',
    application: 'If you don’t own yet, set a down-payment goal; a sensible home is often the foundation under a stock portfolio.',
  },

  // ── Lynch — saving / budgeting (extra coverage) ──
  {
    id: 'lynch-know-your-cashflow',
    bookId: 'one-up-wall-street',
    topics: ['saving', 'budgeting'],
    cures: [1, 2],
    text: 'You can’t invest what you don’t keep — the household that controls its spending is the one with capital to put to work.',
    attribution: 'paraphrase',
    application: 'Tighten the budget to free up cash, then route the surplus into savings and investments.',
  },
]

// ─── Compile-time bookId integrity check ───────────────────
//
// Every Teaching.bookId must resolve to a Book.id. We encode the valid id set
// as a literal union and `satisfies`-assert each teaching's bookId against it,
// so a typo'd bookId is a TYPE error at build time (tsc), not a runtime surprise.

type BookId =
  | 'richest-man-babylon'
  | 'intelligent-investor'
  | 'buffett-letters'
  | 'poor-charlies-almanack'
  | 'one-up-wall-street'
  | 'common-stocks-uncommon-profits'
  | 'little-book-beats-market'
  | 'little-book-common-sense-investing'

// The `Book.id` / `Teaching.bookId` fields are typed `string` by the public
// interfaces, so a mapped array is `string[]` and cannot be `satisfies`-checked
// directly. We instead assert the literal id sets, then fail fast at module load.

// Compile-time: the set of book ids declared in BOOKS must equal the BookId union.
const _BOOK_IDS = [
  'richest-man-babylon',
  'intelligent-investor',
  'buffett-letters',
  'poor-charlies-almanack',
  'one-up-wall-street',
  'common-stocks-uncommon-profits',
  'little-book-beats-market',
  'little-book-common-sense-investing',
] as const satisfies readonly BookId[]

// Module-load (fail-fast) integrity check: (1) BOOKS exactly matches _BOOK_IDS,
// catching any Book added/removed without updating the BookId union; and
// (2) every Teaching.bookId resolves to a real Book.id. Cheap, runs once.
const _declaredIds = new Set<string>(_BOOK_IDS)
const _bookIdSet = new Set(BOOKS.map((b) => b.id))
if (_bookIdSet.size !== _declaredIds.size) {
  throw new Error(
    `wealth-education: BOOKS has ${_bookIdSet.size} ids but BookId union declares ${_declaredIds.size}`,
  )
}
for (const id of _bookIdSet) {
  if (!_declaredIds.has(id)) {
    throw new Error(`wealth-education: BOOKS contains undeclared bookId "${id}"`)
  }
}
for (const t of TEACHINGS) {
  if (!_bookIdSet.has(t.bookId)) {
    throw new Error(
      `wealth-education: teaching "${t.id}" references unknown bookId "${t.bookId}"`,
    )
  }
}

// ─── Helpers ────────────────────────────────────────────────

export function getBook(id: string): Book | undefined {
  return BOOKS.find((b) => b.id === id)
}

export function getTeachingsForTopic(topic: WealthTopic): Teaching[] {
  return TEACHINGS.filter((t) => t.topics.includes(topic))
}

export function getTeachingsForCure(cure: CureNumber): Teaching[] {
  return TEACHINGS.filter((t) => t.cures.includes(cure))
}

export function getTeachingsForBook(bookId: string): Teaching[] {
  return TEACHINGS.filter((t) => t.bookId === bookId)
}
