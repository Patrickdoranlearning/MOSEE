export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">About MOSEE</h1>
      
      {/* Introduction */}
      <section className="mb-12">
        <p className="text-lg text-gray-600 leading-relaxed">
          MOSEE (Margin of Safety & Earnings to Equity) is a stock analysis tool that combines 
          timeless investment wisdom from the greatest investors with modern data analysis. 
          Our goal is to help individual investors make more informed decisions by providing 
          comprehensive, multi-perspective analysis of stocks.
        </p>
      </section>
      
      {/* Investment Philosophy */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Investment Philosophy</h2>
        <div className="bg-blue-50 rounded-xl p-6 mb-6">
          <p className="text-blue-900 italic text-lg">
            &ldquo;Price is what you pay. Value is what you get.&rdquo;
          </p>
          <p className="text-blue-700 text-sm mt-2">— Warren Buffett</p>
        </div>
        <p className="text-gray-600 leading-relaxed">
          MOSEE is built on the principle that successful investing requires understanding 
          the intrinsic value of a business, not just following market trends. We believe 
          in margin of safety — buying at prices that provide a cushion against errors in 
          analysis or unforeseen events.
        </p>
      </section>
      
      {/* The Masters */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">The Investment Masters</h2>
        
        <div className="grid gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Benjamin Graham</h3>
            <p className="text-gray-600 text-sm mb-3">
              The father of value investing. Graham taught us to view stocks as ownership 
              in real businesses, not just ticker symbols. His emphasis on margin of safety 
              remains the cornerstone of intelligent investing.
            </p>
            <div className="text-xs text-gray-500">
              Key metrics: Graham Number, Defensive Criteria Score, P/E & P/B ratios
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Warren Buffett</h3>
            <p className="text-gray-600 text-sm mb-3">
              Graham&apos;s most famous student evolved value investing to focus on quality businesses 
              with durable competitive advantages. Buffett looks for companies that can compound 
              earnings for decades.
            </p>
            <div className="text-xs text-gray-500">
              Key metrics: ROE, ROIC, Owner Earnings, Economic Moat indicators
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Peter Lynch</h3>
            <p className="text-gray-600 text-sm mb-3">
              The legendary Fidelity fund manager who achieved 29% annual returns. Lynch 
              categorized stocks into types and emphasized buying what you know. His PEG 
              ratio balances growth against valuation.
            </p>
            <div className="text-xs text-gray-500">
              Key metrics: PEG Ratio, Earnings Growth, Stock Category (Stalwart, Fast Grower, etc.)
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Philip Fisher</h3>
            <p className="text-gray-600 text-sm mb-3">
              Pioneer of growth investing. Fisher looked for companies with outstanding management, 
              sustainable competitive advantages, and the ability to grow sales and margins over 
              long periods.
            </p>
            <div className="text-xs text-gray-500">
              Key metrics: Sales CAGR, Margin Trends, R&D investment, Management quality
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Joel Greenblatt</h3>
            <p className="text-gray-600 text-sm mb-3">
              Creator of the Magic Formula, which ranks companies by earnings yield and 
              return on capital. This systematic approach identifies quality companies 
              trading at attractive prices.
            </p>
            <div className="text-xs text-gray-500">
              Key metrics: Earnings Yield, Return on Capital, Magic Formula Rank
            </div>
          </div>
        </div>
      </section>
      
      {/* Key Concepts */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Concepts</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Margin of Safety</h3>
            <p className="text-gray-600">
              The difference between a stock&apos;s market price and its estimated intrinsic value. 
              We require a meaningful margin of safety before recommending any stock as a buy. 
              This protects against both analytical errors and unexpected business challenges.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Range-Based Valuation</h3>
            <p className="text-gray-600">
              Rather than providing a single &ldquo;fair value,&rdquo; MOSEE calculates conservative, 
              base, and optimistic valuations. This acknowledges the uncertainty inherent in 
              any valuation exercise and helps you understand the range of possible outcomes.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Quality Score</h3>
            <p className="text-gray-600">
              A composite score that evaluates business quality across multiple dimensions: 
              profitability, financial strength, growth, and capital allocation. Higher quality 
              businesses deserve higher valuations and narrower valuation ranges.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Multi-Lens Analysis</h3>
            <p className="text-gray-600">
              Every stock is analyzed through the lens of multiple investment philosophies. 
              This helps you understand how different investing approaches would view the 
              same company, revealing both opportunities and risks you might otherwise miss.
            </p>
          </div>
        </div>
      </section>
      
      {/* Verdicts */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Understanding Verdicts</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verdict</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meaning</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium">STRONG BUY</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  High quality, significant margin of safety, multiple perspectives bullish
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-green-500 text-white rounded text-xs font-medium">BUY</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Good quality, adequate margin of safety, generally favorable outlook
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium">ACCUMULATE</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Worth adding to existing positions gradually
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-medium">HOLD</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Fairly valued; keep existing positions but don&apos;t add
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-blue-400 text-white rounded text-xs font-medium">WATCHLIST</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Interesting but wait for better entry point
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-orange-500 text-white rounded text-xs font-medium">REDUCE</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Consider trimming existing positions
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-medium">SELL</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Significantly overvalued or deteriorating fundamentals
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-red-700 text-white rounded text-xs font-medium">AVOID</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Poor quality, excessive risk, or serious concerns
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      
      {/* Disclaimer */}
      <section className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
        <h2 className="text-lg font-bold text-yellow-800 mb-2">Important Disclaimer</h2>
        <p className="text-yellow-700 text-sm leading-relaxed">
          MOSEE is a tool for educational and research purposes only. It is not financial advice 
          and should not be used as the sole basis for investment decisions. Past performance 
          does not guarantee future results. Stock investing involves risk, including the 
          potential loss of principal. Always do your own research and consider consulting 
          with a qualified financial advisor before making investment decisions.
        </p>
      </section>
    </div>
  )
}
