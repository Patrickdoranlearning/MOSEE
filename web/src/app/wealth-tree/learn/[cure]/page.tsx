import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SEVEN_CURES, TIER_COLORS } from '@/types/wealth-tree'
import type { CureNumber } from '@/types/wealth-tree'

// Detailed educational content for each cure
const CURE_CONTENT: Record<number, {
  story: string
  keyLessons: string[]
  actionSteps: string[]
  modernApplication: string
  quote: string
}> = {
  1: {
    story: 'Arkad taught that the simplest cure begins with a single discipline: keep a portion of everything you earn. Before paying for any indulgence, before settling any debt — pay yourself first. "For every ten coins thou placest within thy purse, take out for use but nine." This 10% minimum becomes the seed of your wealth tree.',
    keyLessons: [
      'Save at least 10% of all income before any other spending',
      'Pay yourself first — treat savings as your most important bill',
      'Start with whatever you can, even if it feels small',
      'Automate savings so it happens without willpower',
      'Increase the percentage as your income grows',
    ],
    actionSteps: [
      'Set up automatic transfers to a savings account on payday',
      'Track your savings rate in the Income & Savings sections',
      'Start at 10% and aim to increase by 1% each quarter',
      'Create a dedicated "seed" account that you never touch for spending',
    ],
    modernApplication: 'In modern terms, this is the "pay yourself first" principle championed by financial advisors worldwide. Set up automatic payroll deductions or bank transfers so saving happens before you can spend. Use your Wealth Tree to track your actual savings rate vs your 10% target.',
    quote: 'A part of all I earn is mine to keep. Say it in the morning when you first arise. Say it at noon. Say it at night. Say it each hour of every day. Say it to yourself until the words mean something.',
  },
  2: {
    story: 'Arkad observed that even the wealthy can become poor if their desires always exceed their means. "Budget thy expenses that thou mayest have coins to pay for thy necessities, to pay for thy enjoyments and to gratify thy worthwhile desires without spending more than nine-tenths of thy earnings." The key is distinguishing needs from wants.',
    keyLessons: [
      'Create a budget that covers necessities and some enjoyments',
      'Never spend more than 90% of what you earn',
      'Distinguish between needs and desires — question every expense',
      'Desires are infinite; resources are finite',
      'What you call "necessary expenses" will always grow to equal income unless you resist',
    ],
    actionSteps: [
      'Track every expense for a full month in the Expenses section',
      'Categorize spending into needs vs wants',
      'Create a monthly budget with clear category limits',
      'Review and adjust your budget quarterly',
      'Find one "necessary" expense you can reduce or eliminate this week',
    ],
    modernApplication: 'The 50/30/20 rule is a modern descendant: 50% needs, 30% wants, 20% savings. Use the Expenses tracker with the budget pie chart to visualize where your money goes. The goal is awareness — most people have no idea how much they spend in each category.',
    quote: 'Budget thy expenses that thou mayest have coins to pay for thy necessities, to pay for thy enjoyments and to gratify thy worthwhile desires without spending more than nine-tenths of thy earnings.',
  },
  3: {
    story: 'The gold you save is merely the beginning. Arkad taught that gold must be put to work: "Put each coin to laboring that it may reproduce its kind even as the flocks of the field and help bring thee more income." This is the principle of compound growth — where your money earns money, and that money earns more money.',
    keyLessons: [
      'Saving alone is not enough — you must invest',
      'Compound interest is the most powerful force in wealth building',
      'Start investing early — time is your greatest ally',
      'Reinvest your returns for exponential growth',
      'Even small, consistent investments grow into fortunes over decades',
    ],
    actionSteps: [
      'Open an investment account if you don\'t have one',
      'Start with broad index funds (low fees, diversified)',
      'Use the Compound Growth Calculator to visualize your potential',
      'Track your investments in the Investments section',
      'Automate monthly investments alongside your savings',
    ],
    modernApplication: 'Index fund investing (as championed by John Bogle) makes this cure accessible to everyone. A $500/month investment at 7% annual return grows to over $600,000 in 30 years. Use the Calculator to see how your specific numbers play out.',
    quote: 'The gold we may retain from our earnings is but the start. The earnings it will make shall build our fortunes.',
  },
  4: {
    story: 'Arkad warned against the lure of great returns that come with great risk. "Guard thy treasure from loss by investing only where thy principal is safe, where it may be reclaimed if desirable, and where thou will not fail to collect a fair rental." The first principle of investing is: don\'t lose money.',
    keyLessons: [
      'Protect your principal before seeking returns',
      'Build an emergency fund (3-6 months of expenses)',
      'Diversify — never put all eggs in one basket',
      'Seek counsel from wise advisors, not fast-talking salesmen',
      'If an investment sounds too good to be true, it probably is',
    ],
    actionSteps: [
      'Build an emergency fund covering 6 months of expenses',
      'Get adequate insurance (health, home/renters, auto, life)',
      'Diversify investments across asset classes',
      'Track your emergency fund progress in the Savings section',
      'Set up the Debts section to manage and eliminate high-interest debt',
    ],
    modernApplication: 'Warren Buffett echoes this: "Rule #1: Never lose money. Rule #2: Never forget Rule #1." Your emergency fund is your shield against life\'s uncertainties. Having 3-6 months of expenses in liquid savings means you never have to sell investments at a loss to cover emergencies.',
    quote: 'Guard thy treasure from loss by investing only where thy principal is safe, where it may be reclaimed if desirable, and where thou will not fail to collect a fair rental.',
  },
  5: {
    story: 'In ancient Babylon, most people rented their homes from landlords and had little incentive to maintain or improve their dwellings. Arkad taught that owning your home brings both financial stability and emotional contentment. It reduces your ongoing cost of living and builds equity.',
    keyLessons: [
      'Home ownership builds equity over time',
      'A paid-off home dramatically reduces retirement expenses',
      'Real estate can be a source of wealth through appreciation',
      'Your home should be within your means — not a financial burden',
      'Consider the total cost: mortgage, taxes, insurance, maintenance',
    ],
    actionSteps: [
      'If renting, calculate how much you need for a down payment',
      'If you own, track your mortgage payoff in the Debts section',
      'Add your home to Investments to track its value over time',
      'Consider extra principal payments to pay off your mortgage faster',
      'Calculate the rent-vs-buy math for your specific market',
    ],
    modernApplication: 'While the "always buy" advice isn\'t universal (it depends on your market and timeline), building equity in a primary residence remains one of the most common paths to wealth for middle-class families. The key is buying within your means — mortgage payments should not exceed 28% of gross income.',
    quote: 'Own thy own home. Thus may he reduce his cost of living, and have more of his earnings available for pleasures and to build his growing wealth.',
  },
  6: {
    story: 'Arkad taught his students to think beyond the present: "Provide in advance for the needs of thy growing age and the protection of thy family." A man who saves only for today\'s enjoyment will find himself impoverished in old age. The wise man plans decades ahead.',
    keyLessons: [
      'Start retirement planning as early as possible',
      'Build multiple streams of passive income',
      'Life insurance protects your family if something happens to you',
      'Disability insurance protects your income — your greatest asset',
      'Plan for a retirement that could last 30+ years',
    ],
    actionSteps: [
      'Maximize employer 401(k) matching — it\'s free money',
      'Open a Roth IRA for tax-free growth',
      'Calculate how much you need for retirement',
      'Build at least one source of passive income (dividends, rental, etc.)',
      'Review and update beneficiary designations annually',
    ],
    modernApplication: 'The power of tax-advantaged accounts (401k, IRA, Roth, HSA) cannot be overstated. Starting at age 25, contributing $500/month to a retirement account at 7% return yields over $1.2 million by age 65. Starting at 35 yields only ~$567,000. The decade you wait costs you over $600,000.',
    quote: 'Provide in advance for the needs of thy growing age and the protection of thy family.',
  },
  7: {
    story: 'The final cure is perhaps the most powerful: invest in yourself. Arkad declared: "Cultivate thy own powers, study and become wiser, become more skillful." Your earning capacity is your greatest financial asset. A 10% increase in income from skill development compounds across your entire career.',
    keyLessons: [
      'Your ability to earn is your most valuable asset',
      'Invest time and money in education and skill development',
      'Seek mentors and learn from those who have succeeded',
      'Stay curious and adapt to changing markets',
      'The return on self-investment often exceeds any financial investment',
    ],
    actionSteps: [
      'Identify the #1 skill that would increase your income',
      'Budget for education and skill development annually',
      'Track your skill investments in the Skills section',
      'Read at least one book per month on your field or finance',
      'Find a mentor in your industry or desired career path',
    ],
    modernApplication: 'A $5,000 certification or course that leads to a $10,000 salary increase pays for itself in 6 months and compounds over decades. Track your skill investments alongside financial investments — the ROI on education often dwarfs market returns.',
    quote: 'Cultivate thy own powers, study and become wiser, become more skillful, act as to respect thyself.',
  },
}

export default async function CureDetailPage({ params }: { params: Promise<{ cure: string }> }) {
  const { cure: cureParam } = await params
  const cureNumber = parseInt(cureParam) as CureNumber

  if (isNaN(cureNumber) || cureNumber < 1 || cureNumber > 7) {
    notFound()
  }

  const cure = SEVEN_CURES.find(c => c.number === cureNumber)!
  const content = CURE_CONTENT[cureNumber]
  const colors = TIER_COLORS[cure.tier]

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Link href="/wealth-tree/learn" className="text-sm text-gray-500 hover:text-gray-700">
        &larr; Back to all cures
      </Link>

      <div className={`${colors.bg} border ${colors.border} rounded-xl p-8`}>
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
            style={{ backgroundColor: colors.accent }}
          >
            {cureNumber}
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${colors.text}`}>{cure.title}</h1>
            <p className="text-gray-600">{cure.principle}</p>
          </div>
        </div>
      </div>

      {/* Story */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">The Lesson</h2>
        <p className="text-gray-700 leading-relaxed">{content.story}</p>
      </section>

      {/* Quote */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <blockquote className="text-amber-800 italic">&ldquo;{content.quote}&rdquo;</blockquote>
        <p className="text-amber-600 text-sm mt-2">&mdash; The Richest Man in Babylon</p>
      </div>

      {/* Key Lessons */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Key Lessons</h2>
        <ul className="space-y-2">
          {content.keyLessons.map((lesson, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-medium mt-0.5">
                {i + 1}
              </span>
              <span className="text-gray-700">{lesson}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Modern Application */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Modern Application</h2>
        <p className="text-gray-700 leading-relaxed">{content.modernApplication}</p>
      </section>

      {/* Action Steps */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Action Steps</h2>
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {content.actionSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-4">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <span className="text-gray-700 text-sm">{step}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        {cureNumber > 1 ? (
          <Link href={`/wealth-tree/learn/${cureNumber - 1}`}
            className="text-sm text-green-600 hover:text-green-700 font-medium">
            &larr; Cure {cureNumber - 1}
          </Link>
        ) : <span />}
        {cureNumber < 7 ? (
          <Link href={`/wealth-tree/learn/${cureNumber + 1}`}
            className="text-sm text-green-600 hover:text-green-700 font-medium">
            Cure {cureNumber + 1} &rarr;
          </Link>
        ) : <span />}
      </div>
    </div>
  )
}
