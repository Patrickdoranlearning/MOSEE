import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getStockAnalysis } from '@/lib/db'
import { formatCurrency, formatMoS } from '@/types/mosee'

interface RouteContext {
  params: Promise<{ ticker: string }>
}

// Color definitions
const COLORS = {
  primary: [26, 82, 118] as [number, number, number],
  success: [39, 174, 96] as [number, number, number],
  warning: [243, 156, 18] as [number, number, number],
  danger: [231, 76, 60] as [number, number, number],
  muted: [149, 165, 166] as [number, number, number],
  light: [236, 240, 241] as [number, number, number],
  dark: [44, 62, 80] as [number, number, number],
}

const VERDICT_COLORS: Record<string, [number, number, number]> = {
  'STRONG BUY': [30, 132, 73],
  'BUY': [39, 174, 96],
  'ACCUMULATE': [41, 128, 185],
  'HOLD': [243, 156, 18],
  'WATCHLIST': [52, 152, 219],
  'REDUCE': [231, 76, 60],
  'SELL': [192, 57, 43],
  'AVOID': [146, 43, 33],
  'INSUFFICIENT DATA': [149, 165, 166],
}

const GRADE_COLORS: Record<string, [number, number, number]> = {
  'A+': [30, 132, 73],
  'A': [39, 174, 96],
  'B': [46, 204, 113],
  'C': [243, 156, 18],
  'D': [231, 76, 60],
  'F': [146, 43, 33],
}

// ============================================================================
// Chart Drawing Functions (using jsPDF drawing primitives — zero dependencies)
// ============================================================================

interface BarSeries {
  name: string
  values: number[]
  color: [number, number, number]
}

interface LineSeries {
  name: string
  values: (number | null)[]
  color: [number, number, number]
  dashed?: boolean
}

interface RadarDataPoint {
  label: string
  value: number
  maxValue: number
}

/** Format large numbers for chart axes */
function chartFormatValue(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

/** Calculate nice axis bounds and tick values */
function calcAxisTicks(min: number, max: number, numTicks: number): number[] {
  if (min === max) { max = min + 1 }
  const range = max - min
  const rough = range / numTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const nice = rough / mag >= 5 ? 5 * mag : rough / mag >= 2 ? 2 * mag : mag
  const tickMin = Math.floor(min / nice) * nice
  const ticks: number[] = []
  for (let v = tickMin; v <= max + nice * 0.01; v += nice) {
    ticks.push(v)
  }
  return ticks
}

/** Draw a grouped vertical bar chart */
function drawBarChart(
  pdf: jsPDF,
  x: number, y: number, width: number, height: number,
  labels: string[],
  series: BarSeries[],
  title: string,
  formatYValue: (v: number) => string = chartFormatValue,
) {
  const plotLeft = x + 30
  const plotBottom = y + height - 14
  const plotRight = x + width - 5
  const plotTop = y + 18
  const plotWidth = plotRight - plotLeft
  const plotHeight = plotBottom - plotTop

  // Title
  pdf.setFontSize(10)
  pdf.setTextColor(44, 62, 80)
  pdf.setFont('helvetica', 'bold')
  pdf.text(title, x, y + 5)

  // Legend
  let legendX = x
  const legendY = y + 12
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  for (const s of series) {
    pdf.setFillColor(...s.color)
    pdf.rect(legendX, legendY - 2.5, 4, 3, 'F')
    legendX += 5
    pdf.setTextColor(100, 100, 100)
    pdf.text(s.name, legendX, legendY)
    legendX += pdf.getTextWidth(s.name) + 5
  }

  // Calculate range
  let maxVal = 0, minVal = 0
  for (const s of series) {
    for (const v of s.values) {
      if (v > maxVal) maxVal = v
      if (v < minVal) minVal = v
    }
  }
  const yMin = Math.min(0, minVal * 1.05)
  const yMax = maxVal * 1.1 || 1
  const yRange = yMax - yMin

  // Y-axis gridlines and labels
  const ticks = calcAxisTicks(yMin, yMax, 5)
  pdf.setFontSize(6)
  for (const tick of ticks) {
    const yy = plotBottom - ((tick - yMin) / yRange * plotHeight)
    if (yy < plotTop || yy > plotBottom) continue
    pdf.setDrawColor(235, 235, 235)
    pdf.setLineWidth(0.15)
    pdf.line(plotLeft, yy, plotRight, yy)
    pdf.setTextColor(140, 140, 140)
    pdf.text(formatYValue(tick), x + 1, yy + 1)
  }

  // Bars
  const numGroups = labels.length
  const groupWidth = plotWidth / numGroups
  const barGap = 0.8
  const barWidth = Math.min(8, (groupWidth - 4) / series.length - barGap)

  for (let g = 0; g < numGroups; g++) {
    const groupCenter = plotLeft + g * groupWidth + groupWidth / 2
    const totalBarsWidth = series.length * (barWidth + barGap) - barGap
    const barStartX = groupCenter - totalBarsWidth / 2

    for (let s = 0; s < series.length; s++) {
      const val = series[s].values[g]
      if (val == null || isNaN(val)) continue
      const barX = barStartX + s * (barWidth + barGap)
      const zeroY = plotBottom - ((0 - yMin) / yRange * plotHeight)
      const barTopY = plotBottom - ((val - yMin) / yRange * plotHeight)

      pdf.setFillColor(...series[s].color)
      if (val >= 0) {
        pdf.rect(barX, barTopY, barWidth, zeroY - barTopY, 'F')
      } else {
        pdf.rect(barX, zeroY, barWidth, barTopY - zeroY, 'F')
      }
    }

    // X-axis label
    pdf.setFontSize(6)
    pdf.setTextColor(100, 100, 100)
    pdf.text(labels[g], groupCenter, plotBottom + 5, { align: 'center' })
  }

  // Zero line
  if (minVal < 0) {
    const zeroY = plotBottom - ((0 - yMin) / yRange * plotHeight)
    pdf.setDrawColor(180, 180, 180)
    pdf.setLineWidth(0.3)
    pdf.line(plotLeft, zeroY, plotRight, zeroY)
  }

  // Axes
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.3)
  pdf.line(plotLeft, plotTop, plotLeft, plotBottom)
  pdf.line(plotLeft, plotBottom, plotRight, plotBottom)
}

/** Draw a multi-series line chart */
function drawLineChart(
  pdf: jsPDF,
  x: number, y: number, width: number, height: number,
  labels: string[],
  series: LineSeries[],
  title: string,
  formatYValue: (v: number) => string,
) {
  const plotLeft = x + 25
  const plotBottom = y + height - 14
  const plotRight = x + width - 5
  const plotTop = y + 18
  const plotWidth = plotRight - plotLeft
  const plotHeight = plotBottom - plotTop

  // Title
  pdf.setFontSize(10)
  pdf.setTextColor(44, 62, 80)
  pdf.setFont('helvetica', 'bold')
  pdf.text(title, x, y + 5)

  // Legend
  let legendX = x
  const legendY = y + 12
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  for (const s of series) {
    pdf.setDrawColor(...s.color)
    pdf.setLineWidth(0.8)
    if (s.dashed) {
      // Draw dashed legend line manually
      for (let dx = 0; dx < 6; dx += 2) {
        pdf.line(legendX + dx, legendY - 1, legendX + dx + 1, legendY - 1)
      }
    } else {
      pdf.line(legendX, legendY - 1, legendX + 6, legendY - 1)
    }
    legendX += 8
    pdf.setTextColor(100, 100, 100)
    pdf.text(s.name, legendX, legendY)
    legendX += pdf.getTextWidth(s.name) + 6
  }

  // Calculate range
  let maxVal = -Infinity, minVal = Infinity
  for (const s of series) {
    for (const v of s.values) {
      if (v == null) continue
      if (v > maxVal) maxVal = v
      if (v < minVal) minVal = v
    }
  }
  if (!isFinite(maxVal)) { maxVal = 1; minVal = 0 }
  const yMin = minVal * 0.95
  const yMax = maxVal * 1.05
  const yRange = yMax - yMin || 1

  // Y-axis gridlines
  const ticks = calcAxisTicks(yMin, yMax, 5)
  pdf.setFontSize(6)
  for (const tick of ticks) {
    const yy = plotBottom - ((tick - yMin) / yRange * plotHeight)
    if (yy < plotTop || yy > plotBottom) continue
    pdf.setDrawColor(235, 235, 235)
    pdf.setLineWidth(0.15)
    pdf.line(plotLeft, yy, plotRight, yy)
    pdf.setTextColor(140, 140, 140)
    pdf.text(formatYValue(tick), x + 1, yy + 1)
  }

  // Lines
  const numPoints = labels.length
  for (const s of series) {
    pdf.setDrawColor(...s.color)
    pdf.setLineWidth(0.8)
    let prevX: number | null = null, prevY: number | null = null
    for (let i = 0; i < numPoints; i++) {
      const val = s.values[i]
      if (val == null) { prevX = null; prevY = null; continue }
      const px = plotLeft + (i / (numPoints - 1 || 1)) * plotWidth
      const py = plotBottom - ((val - yMin) / yRange * plotHeight)

      if (prevX != null && prevY != null) {
        if (s.dashed) {
          // Approximate dashed line
          const dx = px - prevX, dy = py - prevY
          const len = Math.sqrt(dx * dx + dy * dy)
          const dashLen = 2, gapLen = 1.5
          let d = 0
          while (d < len) {
            const startFrac = d / len
            const endFrac = Math.min((d + dashLen) / len, 1)
            pdf.line(
              prevX + dx * startFrac, prevY + dy * startFrac,
              prevX + dx * endFrac, prevY + dy * endFrac
            )
            d += dashLen + gapLen
          }
        } else {
          pdf.line(prevX, prevY, px, py)
        }
      }

      // Dot
      pdf.setFillColor(...s.color)
      pdf.circle(px, py, 1, 'F')
      prevX = px
      prevY = py
    }
  }

  // X-axis labels
  pdf.setFontSize(6)
  pdf.setTextColor(100, 100, 100)
  for (let i = 0; i < numPoints; i++) {
    const px = plotLeft + (i / (numPoints - 1 || 1)) * plotWidth
    pdf.text(labels[i], px, plotBottom + 5, { align: 'center' })
  }

  // Axes
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.3)
  pdf.line(plotLeft, plotTop, plotLeft, plotBottom)
  pdf.line(plotLeft, plotBottom, plotRight, plotBottom)
}

/** Draw a radar/spider chart */
function drawRadarChart(
  pdf: jsPDF,
  centerX: number, centerY: number, radius: number,
  data: RadarDataPoint[],
  title: string,
  fillColor: [number, number, number] = [59, 130, 246],
) {
  const n = data.length
  if (n < 3) return

  // Title
  pdf.setFontSize(10)
  pdf.setTextColor(44, 62, 80)
  pdf.setFont('helvetica', 'bold')
  pdf.text(title, centerX, centerY - radius - 8, { align: 'center' })

  // Draw grid rings
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0]
  for (const ring of rings) {
    pdf.setDrawColor(230, 230, 230)
    pdf.setLineWidth(0.15)
    for (let i = 0; i < n; i++) {
      const angle1 = (Math.PI * 2 * i / n) - Math.PI / 2
      const angle2 = (Math.PI * 2 * ((i + 1) % n) / n) - Math.PI / 2
      pdf.line(
        centerX + Math.cos(angle1) * radius * ring,
        centerY + Math.sin(angle1) * radius * ring,
        centerX + Math.cos(angle2) * radius * ring,
        centerY + Math.sin(angle2) * radius * ring,
      )
    }
  }

  // Draw spokes and labels
  pdf.setFontSize(7)
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2
    const spokeEndX = centerX + Math.cos(angle) * radius
    const spokeEndY = centerY + Math.sin(angle) * radius

    pdf.setDrawColor(210, 210, 210)
    pdf.setLineWidth(0.15)
    pdf.line(centerX, centerY, spokeEndX, spokeEndY)

    // Label
    const labelDist = radius + 6
    const labelX = centerX + Math.cos(angle) * labelDist
    const labelY = centerY + Math.sin(angle) * labelDist
    pdf.setTextColor(80, 80, 80)
    const align = Math.abs(Math.cos(angle)) < 0.1 ? 'center' as const
      : Math.cos(angle) > 0 ? 'left' as const : 'right' as const
    pdf.text(data[i].label, labelX, labelY + 1, { align })

    // Score under label
    pdf.setFontSize(6)
    pdf.setTextColor(120, 120, 120)
    pdf.text(`${data[i].value.toFixed(0)}`, labelX, labelY + 4.5, { align })
    pdf.setFontSize(7)
  }

  // Draw data polygon (filled with transparency)
  const points: Array<[number, number]> = data.map((d, i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2
    const frac = d.maxValue > 0 ? d.value / d.maxValue : 0
    return [
      centerX + Math.cos(angle) * radius * frac,
      centerY + Math.sin(angle) * radius * frac,
    ]
  })

  // Fill polygon using triangles from center (with lighter fill color for transparency effect)
  const lightFill: [number, number, number] = [
    Math.min(255, fillColor[0] + Math.round((255 - fillColor[0]) * 0.75)),
    Math.min(255, fillColor[1] + Math.round((255 - fillColor[1]) * 0.75)),
    Math.min(255, fillColor[2] + Math.round((255 - fillColor[2]) * 0.75)),
  ]
  pdf.setFillColor(...lightFill)
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    pdf.triangle(
      centerX, centerY,
      points[i][0], points[i][1],
      points[next][0], points[next][1],
      'F'
    )
  }

  // Outline
  pdf.setDrawColor(...fillColor)
  pdf.setLineWidth(0.8)
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    pdf.line(points[i][0], points[i][1], points[next][0], points[next][1])
  }

  // Dots at vertices
  for (const [px, py] of points) {
    pdf.setFillColor(...fillColor)
    pdf.circle(px, py, 1, 'F')
  }
}

/** Draw a horizontal bar chart for valuation comparison */
function drawHorizontalBarChart(
  pdf: jsPDF,
  x: number, y: number, width: number, height: number,
  items: Array<{ label: string; value: number; color: [number, number, number] }>,
  referenceLine: { value: number; label: string } | null,
  title: string,
) {
  const plotLeft = x + 35
  const plotRight = x + width - 10
  const plotTop = y + 12
  const plotBottom = y + height - 5
  const plotWidth = plotRight - plotLeft

  // Title
  pdf.setFontSize(10)
  pdf.setTextColor(44, 62, 80)
  pdf.setFont('helvetica', 'bold')
  pdf.text(title, x, y + 5)

  // Calculate X range
  let maxVal = 0
  for (const item of items) {
    if (item.value > maxVal) maxVal = item.value
  }
  if (referenceLine && referenceLine.value > maxVal) maxVal = referenceLine.value
  maxVal *= 1.1

  const barHeight = Math.min(10, (plotBottom - plotTop) / items.length - 3)
  const barGap = ((plotBottom - plotTop) - barHeight * items.length) / (items.length + 1)

  // Bars
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const barY = plotTop + barGap + i * (barHeight + barGap)
    const barW = (item.value / maxVal) * plotWidth

    // Label
    pdf.setFontSize(8)
    pdf.setTextColor(80, 80, 80)
    pdf.text(item.label, plotLeft - 3, barY + barHeight / 2 + 1, { align: 'right' })

    // Bar
    pdf.setFillColor(...item.color)
    pdf.rect(plotLeft, barY, barW, barHeight, 'F')

    // Value label
    pdf.setFontSize(7)
    pdf.setTextColor(60, 60, 60)
    pdf.text(chartFormatValue(item.value), plotLeft + barW + 2, barY + barHeight / 2 + 1)
  }

  // Reference line (current price)
  if (referenceLine) {
    const refX = plotLeft + (referenceLine.value / maxVal) * plotWidth
    pdf.setDrawColor(55, 65, 81)
    pdf.setLineWidth(0.6)
    // Dashed line
    for (let yy = plotTop; yy < plotBottom; yy += 3) {
      pdf.line(refX, yy, refX, Math.min(yy + 1.5, plotBottom))
    }
    pdf.setFontSize(7)
    pdf.setTextColor(55, 65, 81)
    pdf.setFont('helvetica', 'bold')
    pdf.text(referenceLine.label, refX, plotTop - 2, { align: 'center' })
    pdf.setFont('helvetica', 'normal')
  }
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { ticker } = await context.params
  const sanitizedTicker = ticker.toUpperCase().replace(/[^A-Z0-9.-]/g, '')

  try {
    // Fetch stock data from database
    const stock = await getStockAnalysis(sanitizedTicker)

    if (!stock) {
      return NextResponse.json(
        { error: 'Stock not found', ticker: sanitizedTicker },
        { status: 404 }
      )
    }

    // Generate PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    let yPos = margin

    // Helper to add page break if needed
    const checkPageBreak = (neededSpace: number) => {
      if (yPos + neededSpace > pageHeight - margin) {
        pdf.addPage()
        yPos = margin
        return true
      }
      return false
    }

    // === PAGE 1: EXECUTIVE SUMMARY ===

    // Header
    pdf.setFontSize(24)
    pdf.setTextColor(...COLORS.primary)
    pdf.setFont('helvetica', 'bold')
    pdf.text(sanitizedTicker, margin, yPos)

    if (stock.company_name) {
      pdf.setFontSize(14)
      pdf.setTextColor(...COLORS.dark)
      pdf.setFont('helvetica', 'normal')
      pdf.text(` - ${stock.company_name}`, margin + pdf.getTextWidth(sanitizedTicker) + 2, yPos)
    }
    yPos += 8

    // Subtitle
    const subtitleParts = []
    if (stock.industry) subtitleParts.push(stock.industry)
    if (stock.country) subtitleParts.push(stock.country)
    if (stock.cap_size) subtitleParts.push(`${stock.cap_size.charAt(0).toUpperCase() + stock.cap_size.slice(1)} Cap`)

    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.muted)
    pdf.text(subtitleParts.join(' | '), margin, yPos)
    yPos += 5

    // Analysis date
    const analysisDate = new Date(stock.analysis_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    pdf.text(`Analysis Date: ${analysisDate}`, margin, yPos)
    yPos += 8

    // Horizontal line
    pdf.setDrawColor(...COLORS.light)
    pdf.setLineWidth(0.5)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 8

    // Page Title
    pdf.setFontSize(16)
    pdf.setTextColor(...COLORS.primary)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Executive Summary', margin, yPos)
    yPos += 12

    // Verdict Box
    const verdictColor = VERDICT_COLORS[stock.verdict] || COLORS.muted
    const verdictBoxWidth = pageWidth - (2 * margin)
    const verdictBoxHeight = 18

    pdf.setFillColor(...verdictColor)
    pdf.roundedRect(margin, yPos, verdictBoxWidth, verdictBoxHeight, 3, 3, 'F')

    pdf.setFontSize(20)
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    const verdictText = stock.verdict
    const verdictWidth = pdf.getTextWidth(verdictText)
    pdf.text(verdictText, margin + (verdictBoxWidth - verdictWidth) / 2, yPos + 12)
    yPos += verdictBoxHeight + 5

    // Recommendation text (from verdict rationale)
    const reportAllMetrics = (stock.all_metrics || {}) as Record<string, unknown>
    const verdictRationale = reportAllMetrics.verdict_rationale as { gates?: Array<{ gate: string; passed: boolean; detail: string }>; thresholds?: Record<string, number>; summary?: string } | undefined
    const recommendationText = reportAllMetrics.recommendation_text as string | undefined

    if (verdictRationale?.summary || recommendationText) {
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.dark)
      pdf.setFont('helvetica', 'italic')
      const recText = verdictRationale?.summary || recommendationText || ''
      const recLines = pdf.splitTextToSize(recText, verdictBoxWidth)
      for (const line of recLines) {
        pdf.text(line, margin, yPos)
        yPos += 4.5
      }
      yPos += 3
    }

    // Investment horizon note
    pdf.setFontSize(9)
    pdf.setTextColor(41, 128, 185)
    pdf.setFont('helvetica', 'italic')
    const horizonText = 'MOSEE analyses companies as 5-10 year investments. Reports reflect long-term fundamentals, not short-term price movements.'
    const horizonWidth = pdf.getTextWidth(horizonText)
    pdf.text(horizonText, margin + (verdictBoxWidth - horizonWidth) / 2, yPos)
    yPos += 8

    // Key Metrics Table
    const qualityGrade = stock.quality_grade || 'N/A'
    const qualityScore = stock.quality_score?.toFixed(0) || 'N/A'
    const mosRatio = stock.margin_of_safety
    const hasMoS = stock.has_margin_of_safety

    let mosText = 'N/A'
    if (mosRatio != null && isFinite(mosRatio)) {
      if (hasMoS) {
        mosText = `${(mosRatio * 100).toFixed(0)}% - Good MoS`
      } else if (mosRatio < 1.0) {
        mosText = `${(mosRatio * 100).toFixed(0)}% - Fair`
      } else {
        mosText = `${(mosRatio * 100).toFixed(0)}% - No MoS`
      }
    }

    autoTable(pdf, {
      startY: yPos,
      head: [['Current Price', 'Quality', 'Margin of Safety', 'Buy Below']],
      body: [[
        formatCurrency(stock.current_price),
        `${qualityGrade} (${qualityScore}/100)`,
        mosText,
        formatCurrency(stock.buy_below_price)
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.light,
        textColor: COLORS.muted,
        fontStyle: 'normal',
        fontSize: 9
      },
      bodyStyles: {
        fontStyle: 'bold',
        fontSize: 11,
        halign: 'center'
      },
      columnStyles: {
        1: { textColor: GRADE_COLORS[qualityGrade] || COLORS.dark },
        2: { textColor: hasMoS ? COLORS.success : (mosRatio && mosRatio < 1 ? COLORS.warning : COLORS.danger) }
      },
      margin: { left: margin, right: margin }
    })

    yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12

    // Strengths and Concerns
    const strengths = stock.strengths || []
    const concerns = stock.concerns || []

    if (strengths.length > 0 || concerns.length > 0) {
      pdf.setFontSize(12)
      pdf.setTextColor(...COLORS.dark)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Investment Analysis', margin, yPos)
      yPos += 8

      if (strengths.length > 0) {
        pdf.setFontSize(10)
        pdf.setTextColor(...COLORS.success)
        pdf.setFont('helvetica', 'bold')
        pdf.text('STRENGTHS', margin, yPos)
        yPos += 5

        pdf.setFont('helvetica', 'normal')
        for (const strength of strengths.slice(0, 5)) {
          checkPageBreak(6)
          pdf.text(`+ ${strength}`, margin + 5, yPos)
          yPos += 5
        }
        yPos += 3
      }

      if (concerns.length > 0) {
        pdf.setFontSize(10)
        pdf.setTextColor(...COLORS.danger)
        pdf.setFont('helvetica', 'bold')
        pdf.text('CONCERNS', margin, yPos)
        yPos += 5

        pdf.setFont('helvetica', 'normal')
        for (const concern of concerns.slice(0, 5)) {
          checkPageBreak(6)
          pdf.text(`- ${concern}`, margin + 5, yPos)
          yPos += 5
        }
        yPos += 3
      }
    }

    yPos += 5

    // Verdict Decision Gates (if available)
    if (verdictRationale?.gates && verdictRationale.gates.length > 0) {
      checkPageBreak(40)
      pdf.setFontSize(12)
      pdf.setTextColor(...COLORS.dark)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Verdict Decision Path', margin, yPos)
      yPos += 6

      autoTable(pdf, {
        startY: yPos,
        head: [['Gate', 'Status', 'Detail']],
        body: verdictRationale.gates.map(g => [
          g.gate,
          g.passed ? 'PASSED' : 'FAILED',
          g.detail.substring(0, 80)
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: COLORS.primary,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8,
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 35 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'left' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const gate = verdictRationale.gates![data.row.index]
            data.cell.styles.textColor = gate?.passed ? COLORS.success : COLORS.danger
            data.cell.styles.fontStyle = 'bold'
          }
        },
        margin: { left: margin, right: margin }
      })

      yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    }

    // Market Data Table
    checkPageBreak(30)
    pdf.setFontSize(12)
    pdf.setTextColor(...COLORS.dark)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Market Data', margin, yPos)
    yPos += 6

    const confBreakdown = reportAllMetrics.confidence_breakdown as { data_quality_score?: number; metric_consistency_score?: number } | undefined
    const confDetail = confBreakdown
      ? `${stock.confidence_level || 'N/A'} (DQ: ${confBreakdown.data_quality_score?.toFixed(0) ?? '?'}, MC: ${confBreakdown.metric_consistency_score?.toFixed(0) ?? '?'})`
      : (stock.confidence_level || 'N/A')

    autoTable(pdf, {
      startY: yPos,
      head: [['Market Cap', 'Confidence (Data Quality / Metric Consistency)', 'MOSEE Score']],
      body: [[
        formatCurrency(stock.market_cap),
        confDetail,
        stock.pad_mosee?.toFixed(4) || 'N/A'
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.light,
        textColor: COLORS.muted,
        fontStyle: 'normal',
        fontSize: 9
      },
      bodyStyles: {
        fontStyle: 'bold',
        fontSize: 11,
        halign: 'center'
      },
      margin: { left: margin, right: margin }
    })

    yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15

    // === PAGE 2: VALUATION ANALYSIS ===
    pdf.addPage()
    yPos = margin

    // Header for page 2
    pdf.setFontSize(20)
    pdf.setTextColor(...COLORS.primary)
    pdf.setFont('helvetica', 'bold')
    pdf.text(sanitizedTicker, margin, yPos)
    yPos += 8

    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.muted)
    pdf.text(subtitleParts.join(' | ') + ` | Analysis: ${analysisDate}`, margin, yPos)
    yPos += 8

    pdf.setDrawColor(...COLORS.light)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 8

    pdf.setFontSize(16)
    pdf.setTextColor(...COLORS.primary)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Valuation Analysis', margin, yPos)
    yPos += 12

    // Valuation Range Table
    pdf.setFontSize(12)
    pdf.setTextColor(...COLORS.dark)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Intrinsic Value Range', margin, yPos)
    yPos += 6

    const currentPrice = stock.current_price || 0
    const getVsPriceColor = (value: number | null): [number, number, number] => {
      if (!value || !currentPrice) return COLORS.dark
      const diff = ((currentPrice / value) - 1) * 100
      if (diff < 0) return COLORS.success
      if (diff < 15) return COLORS.warning
      return COLORS.danger
    }

    const formatVsPrice = (value: number | null): string => {
      if (!value || !currentPrice) return 'N/A'
      const diff = ((currentPrice / value) - 1) * 100
      return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`
    }

    autoTable(pdf, {
      startY: yPos,
      head: [['Scenario', 'Value', 'vs Current Price']],
      body: [
        ['Conservative', formatCurrency(stock.valuation_conservative), formatVsPrice(stock.valuation_conservative)],
        ['Base Case', formatCurrency(stock.valuation_base), formatVsPrice(stock.valuation_base)],
        ['Optimistic', formatCurrency(stock.valuation_optimistic), formatVsPrice(stock.valuation_optimistic)]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 10,
        halign: 'center'
      },
      columnStyles: {
        0: { fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const rowIndex = data.row.index
          const values = [stock.valuation_conservative, stock.valuation_base, stock.valuation_optimistic]
          const color = getVsPriceColor(values[rowIndex])
          data.cell.styles.textColor = color
        }
      },
      margin: { left: margin, right: margin }
    })

    yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

    // Valuation confidence
    pdf.setFontSize(9)
    pdf.setTextColor(...COLORS.muted)
    pdf.text(`Valuation Confidence: ${stock.valuation_confidence || 'N/A'}`, margin, yPos)
    yPos += 10

    // --- CHART: Valuation Comparison ---
    {
      const chartItems: Array<{ label: string; value: number; color: [number, number, number] }> = []
      if (stock.valuation_conservative && stock.valuation_conservative > 0) {
        chartItems.push({ label: 'Conservative', value: stock.valuation_conservative, color: [231, 76, 60] })
      }
      if (stock.valuation_base && stock.valuation_base > 0) {
        chartItems.push({ label: 'Base Case', value: stock.valuation_base, color: [243, 156, 18] })
      }
      if (stock.valuation_optimistic && stock.valuation_optimistic > 0) {
        chartItems.push({ label: 'Optimistic', value: stock.valuation_optimistic, color: [39, 174, 96] })
      }
      if (chartItems.length > 0) {
        checkPageBreak(55)
        drawHorizontalBarChart(
          pdf, margin, yPos, pageWidth - 2 * margin, 45,
          chartItems,
          currentPrice > 0 ? { value: currentPrice, label: `Current: ${formatCurrency(currentPrice)}` } : null,
          'Valuation vs Current Price',
        )
        yPos += 55
      }
    }

    // MoS Scores Table — enhanced with intrinsic values and implied market cap
    pdf.setFontSize(12)
    pdf.setTextColor(...COLORS.dark)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Valuation Methods Comparison', margin, yPos)
    yPos += 6

    // Extract per-method intrinsic values
    const pdfRangeDetails = reportAllMetrics.valuation_range_details as { individual_valuations?: Array<{ method: string; conservative: number; base: number; optimistic: number }> } | undefined
    const valLookup: Record<string, { base: number; conservative: number; optimistic: number }> = {}
    if (pdfRangeDetails?.individual_valuations) {
      for (const v of pdfRangeDetails.individual_valuations) {
        valLookup[v.method.toLowerCase()] = { base: v.base, conservative: v.conservative, optimistic: v.optimistic }
      }
    }

    const pdfSharesOutstanding = stock.market_cap && stock.current_price && stock.current_price > 0
      ? stock.market_cap / stock.current_price : null

    const methodRows = [
      { name: 'PAD (Primary)', key: 'pad', mos: stock.pad_mos, mosee: stock.pad_mosee },
      { name: 'DCF', key: 'dcf', mos: stock.dcf_mos, mosee: stock.dcf_mosee },
      { name: 'Book Value', key: 'book_value', mos: stock.book_mos, mosee: stock.book_mosee },
    ]

    const hasValData = Object.keys(valLookup).length > 0

    autoTable(pdf, {
      startY: yPos,
      head: [hasValData
        ? ['Method', 'Intrinsic Value', 'Implied Mkt Cap', 'MoS', 'MOSEE']
        : ['Method', 'MoS Score', 'MOSEE Score']
      ],
      body: methodRows.map(m => {
        const vals = valLookup[m.key]
        const base = vals?.base
        const impliedMcap = base && pdfSharesOutstanding ? base * pdfSharesOutstanding : null

        if (hasValData) {
          return [
            m.name,
            base != null ? `${formatCurrency(base)}/sh` : 'N/A',
            impliedMcap != null ? formatCurrency(impliedMcap) : 'N/A',
            formatMoS(m.mos),
            m.mosee?.toFixed(4) || 'N/A',
          ]
        }
        return [m.name, formatMoS(m.mos), m.mosee?.toFixed(4) || 'N/A']
      }),
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 9,
        halign: 'center'
      },
      columnStyles: {
        0: { fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin }
    })

    yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15

    // Valuation Method Details with full calculation chains
    const rangeDetails = reportAllMetrics.valuation_range_details as { individual_valuations?: Array<{ method: string; conservative: number; base: number; optimistic: number; confidence: string; assumptions?: Record<string, unknown> }> } | undefined
    if (rangeDetails?.individual_valuations && rangeDetails.individual_valuations.length > 0) {
      checkPageBreak(40)
      pdf.setFontSize(12)
      pdf.setTextColor(...COLORS.dark)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Valuation Method Details', margin, yPos)
      yPos += 8

      for (const val of rangeDetails.individual_valuations) {
        checkPageBreak(30)
        pdf.setFontSize(10)
        pdf.setTextColor(...COLORS.dark)
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${val.method} (${val.confidence})`, margin + 3, yPos)
        yPos += 5

        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(...COLORS.muted)
        pdf.text(`Conservative: ${formatCurrency(val.conservative)} | Base: ${formatCurrency(val.base)} | Optimistic: ${formatCurrency(val.optimistic)}`, margin + 3, yPos)
        yPos += 5

        // Calculation chain
        const calcChain = val.assumptions?.calculation_chain as string[] | undefined
        if (calcChain && calcChain.length > 0) {
          pdf.setFontSize(8)
          for (const step of calcChain) {
            checkPageBreak(5)
            const stepLines = pdf.splitTextToSize(`  ${step}`, pageWidth - (2 * margin) - 10)
            for (const line of stepLines) {
              pdf.text(line, margin + 5, yPos)
              yPos += 3.5
            }
          }
        }
        yPos += 4
      }
    }

    // === VALUATION BASIS DATA — Full year-by-year breakdowns ===
    const valuationBasis = reportAllMetrics.valuation_basis as Record<string, unknown> | undefined
    const financials = reportAllMetrics.financial_statements as Record<string, unknown> | undefined

    if (valuationBasis || financials) {
      pdf.addPage()
      yPos = margin

      // Header
      pdf.setFontSize(20)
      pdf.setTextColor(...COLORS.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text(sanitizedTicker, margin, yPos)
      yPos += 8
      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.muted)
      pdf.text(subtitleParts.join(' | ') + ` | Analysis: ${analysisDate}`, margin, yPos)
      yPos += 8
      pdf.setDrawColor(...COLORS.light)
      pdf.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 8

      pdf.setFontSize(16)
      pdf.setTextColor(...COLORS.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Valuation Basis Data', margin, yPos)
      yPos += 5
      pdf.setFontSize(9)
      pdf.setTextColor(...COLORS.muted)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Detailed breakdown of inputs, assumptions, and year-by-year calculations for each valuation method.', margin, yPos)
      yPos += 10

      // Helper: render a valuation method breakdown (PAD or DCF)
      const renderValuationBreakdown = (title: string, breakdown: Record<string, unknown>) => {
        const inputs = breakdown.inputs as Record<string, number | string> | undefined
        const yearByYear = breakdown.year_by_year as Array<Record<string, number>> | undefined
        const totalPV = breakdown.total_present_value as number | undefined

        checkPageBreak(50)
        pdf.setFontSize(11)
        pdf.setTextColor(...COLORS.dark)
        pdf.setFont('helvetica', 'bold')
        pdf.text(title, margin, yPos)
        yPos += 7

        // Inputs table
        if (inputs && Object.keys(inputs).length > 0) {
          const inputRows = Object.entries(inputs).map(([key, val]) => {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            let formatted: string
            if (typeof val === 'number') {
              formatted = Math.abs(val) < 1 && val !== 0 ? `${(val * 100).toFixed(1)}%` : formatCurrency(val)
            } else {
              formatted = String(val)
            }
            return [label, formatted]
          })

          // Split into 2-column layout
          const halfLen = Math.ceil(inputRows.length / 2)
          const leftCols = inputRows.slice(0, halfLen)
          const rightCols = inputRows.slice(halfLen)
          const twoColRows = leftCols.map((left, i) => {
            const right = rightCols[i]
            return right ? [...left, ...right] : [...left, '', '']
          })

          autoTable(pdf, {
            startY: yPos,
            head: [['Input', 'Value', 'Input', 'Value']],
            body: twoColRows,
            theme: 'plain',
            headStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 0: { fontStyle: 'bold', halign: 'left' }, 1: { halign: 'right' }, 2: { fontStyle: 'bold', halign: 'left' }, 3: { halign: 'right' } },
            margin: { left: margin, right: margin },
          })
          yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
        }

        // Year-by-year table
        if (yearByYear && yearByYear.length > 0) {
          const first = yearByYear[0]
          const hasFutureCF = first.future_cash_flow != null
          const hasProjectedCF = first.projected_cash_flow != null
          const hasFutureCFShort = first.future_cf != null
          const hasCumulativePV = first.cumulative_pv != null

          const getCF = (row: Record<string, number>): number | undefined => {
            if (hasFutureCF) return row.future_cash_flow
            if (hasProjectedCF) return row.projected_cash_flow
            if (hasFutureCFShort) return row.future_cf
            return undefined
          }

          const headers: string[] = ['Year']
          if (hasFutureCF || hasProjectedCF || hasFutureCFShort) headers.push('Cash Flow')
          headers.push('Discount Factor', 'Present Value')
          if (hasCumulativePV) headers.push('Cumulative PV')

          const bodyRows = yearByYear.map(row => {
            const cells: string[] = [String(row.year)]
            const cf = getCF(row)
            if (hasFutureCF || hasProjectedCF || hasFutureCFShort) cells.push(cf != null ? formatCurrency(cf) : '-')
            cells.push(row.discount_factor?.toFixed(4) ?? '-')
            cells.push(formatCurrency(row.present_value))
            if (hasCumulativePV) cells.push(formatCurrency(row.cumulative_pv))
            return cells
          })

          autoTable(pdf, {
            startY: yPos,
            head: [headers],
            body: bodyRows,
            theme: 'grid',
            headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, halign: 'right', font: 'courier' },
            columnStyles: { 0: { halign: 'left', font: 'helvetica' } },
            margin: { left: margin, right: margin },
          })
          yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3
        }

        // Total Present Value
        if (totalPV != null) {
          pdf.setFontSize(9)
          pdf.setTextColor(...COLORS.success)
          pdf.setFont('helvetica', 'bold')
          pdf.text(`Total Present Value: ${formatCurrency(totalPV)}`, margin + 3, yPos)
          yPos += 8
        }
      }

      // PAD Valuation
      if (valuationBasis?.pad) {
        renderValuationBreakdown('PAD Valuation (Compound Growth)', valuationBasis.pad as Record<string, unknown>)
      }

      // DCF Valuation
      if (valuationBasis?.dcf) {
        renderValuationBreakdown('DCF Valuation (Linear Regression)', valuationBasis.dcf as Record<string, unknown>)
      }

      // PAD Dividend Valuation
      if (valuationBasis?.pad_dividend) {
        renderValuationBreakdown('PAD Dividend Valuation', valuationBasis.pad_dividend as Record<string, unknown>)
      }

      // Book Value Breakdown
      const bookData = valuationBasis?.book_value as { method?: string; latest?: { total_assets: number; total_liabilities: number; book_value: number }; historical?: Array<{ year: number; total_assets: number; total_liabilities: number; book_value: number }> } | undefined
      if (bookData?.latest) {
        checkPageBreak(40)
        pdf.setFontSize(11)
        pdf.setTextColor(...COLORS.dark)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Book Value Breakdown', margin, yPos)
        yPos += 7

        autoTable(pdf, {
          startY: yPos,
          head: [['Total Assets', 'Total Liabilities', 'Book Value']],
          body: [[
            formatCurrency(bookData.latest.total_assets),
            formatCurrency(bookData.latest.total_liabilities),
            formatCurrency(bookData.latest.book_value),
          ]],
          theme: 'grid',
          headStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 10, halign: 'center', fontStyle: 'bold' },
          margin: { left: margin, right: margin },
        })
        yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3

        if (bookData.historical && bookData.historical.length > 0) {
          autoTable(pdf, {
            startY: yPos,
            head: [['Year', 'Total Assets', 'Total Liabilities', 'Book Value']],
            body: bookData.historical.map(row => [
              String(row.year),
              formatCurrency(row.total_assets),
              formatCurrency(row.total_liabilities),
              formatCurrency(row.book_value),
            ]),
            theme: 'grid',
            headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, halign: 'right', font: 'courier' },
            columnStyles: { 0: { halign: 'left', font: 'helvetica' } },
            margin: { left: margin, right: margin },
          })
          yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
        }
      }

      // === Financial Statements ===
      if (financials) {
        // Helper to render a yearly series table
        const renderYearlySeries = (
          sectionTitle: string,
          series: Record<string, unknown>,
          columns: Array<{ key: string; label: string; isPercent?: boolean }>
        ) => {
          // Collect all years
          const yearsSet = new Set<number>()
          for (const col of columns) {
            const s = series[col.key]
            if (Array.isArray(s)) {
              (s as Array<{ year: number; value: number }>).forEach(dp => yearsSet.add(dp.year))
            }
          }
          const sortedYears = Array.from(yearsSet).sort()
          if (sortedYears.length === 0) return

          // Build lookup
          const lookup: Record<string, Record<number, number>> = {}
          for (const col of columns) {
            lookup[col.key] = {}
            const s = series[col.key]
            if (Array.isArray(s)) {
              (s as Array<{ year: number; value: number }>).forEach(dp => {
                lookup[col.key][dp.year] = dp.value
              })
            }
          }

          checkPageBreak(30 + sortedYears.length * 7)
          pdf.setFontSize(11)
          pdf.setTextColor(...COLORS.dark)
          pdf.setFont('helvetica', 'bold')
          pdf.text(sectionTitle, margin, yPos)
          yPos += 7

          const headers = ['Year', ...columns.map(c => c.label)]
          const bodyRows = sortedYears.map(year => {
            const cells: string[] = [String(year)]
            for (const col of columns) {
              const val = lookup[col.key]?.[year]
              if (val != null) {
                cells.push(col.isPercent ? `${(val * 100).toFixed(1)}%` : formatCurrency(val))
              } else {
                cells.push('-')
              }
            }
            return cells
          })

          autoTable(pdf, {
            startY: yPos,
            head: [headers],
            body: bodyRows,
            theme: 'grid',
            headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
            bodyStyles: { fontSize: 7, halign: 'right', font: 'courier' },
            columnStyles: { 0: { halign: 'left', font: 'helvetica' } },
            margin: { left: margin, right: margin },
          })
          yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
        }

        // New page for financial statements
        pdf.addPage()
        yPos = margin
        pdf.setFontSize(20)
        pdf.setTextColor(...COLORS.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text(sanitizedTicker, margin, yPos)
        yPos += 8
        pdf.setFontSize(10)
        pdf.setTextColor(...COLORS.muted)
        pdf.text(subtitleParts.join(' | ') + ` | Analysis: ${analysisDate}`, margin, yPos)
        yPos += 8
        pdf.setDrawColor(...COLORS.light)
        pdf.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 8
        pdf.setFontSize(16)
        pdf.setTextColor(...COLORS.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Financial Statements', margin, yPos)
        yPos += 12

        const incomeStatement = financials.income_statement as Record<string, unknown> | undefined
        const cashFlow = financials.cash_flow as Record<string, unknown> | undefined
        const balanceSheet = financials.balance_sheet as Record<string, unknown> | undefined
        const ownerEarnings = financials.owner_earnings as {
          net_income?: Array<{ year: number; value: number }>
          depreciation?: Array<{ year: number; value: number }>
          capex?: Array<{ year: number; value: number }>
          owners_earnings?: Array<{ year: number; value: number }>
          avg_capex?: number
          formula?: string
        } | undefined

        if (incomeStatement) {
          renderYearlySeries('Income Statement', incomeStatement, [
            { key: 'revenue', label: 'Revenue' },
            { key: 'gross_profit', label: 'Gross Profit' },
            { key: 'ebit', label: 'EBIT' },
            { key: 'net_income', label: 'Net Income' },
            { key: 'net_margin', label: 'Net Margin', isPercent: true },
          ])
        }

        if (cashFlow) {
          renderYearlySeries('Cash Flow Statement', cashFlow, [
            { key: 'operating_cash_flow', label: 'Operating CF' },
            { key: 'capex', label: 'CapEx' },
            { key: 'free_cash_flow', label: 'Free CF' },
            { key: 'depreciation', label: 'D&A' },
          ])
        }

        if (balanceSheet) {
          renderYearlySeries('Balance Sheet', balanceSheet, [
            { key: 'total_assets', label: 'Assets' },
            { key: 'total_liabilities', label: 'Liabilities' },
            { key: 'stockholders_equity', label: 'Equity' },
            { key: 'total_debt', label: 'Debt' },
          ])
        }

        // Owner Earnings breakdown
        if (ownerEarnings?.owners_earnings && Array.isArray(ownerEarnings.owners_earnings) && ownerEarnings.owners_earnings.length > 0) {
          checkPageBreak(50)
          pdf.setFontSize(11)
          pdf.setTextColor(...COLORS.dark)
          pdf.setFont('helvetica', 'bold')
          pdf.text('Owner Earnings (Buffett)', margin, yPos)
          yPos += 5

          if (ownerEarnings.formula) {
            pdf.setFontSize(8)
            pdf.setTextColor(...COLORS.muted)
            pdf.setFont('helvetica', 'italic')
            pdf.text(`Formula: ${ownerEarnings.formula}`, margin + 3, yPos)
            yPos += 4
            if (ownerEarnings.avg_capex != null) {
              pdf.text(`Average CapEx (maintenance proxy): ${formatCurrency(ownerEarnings.avg_capex)}`, margin + 3, yPos)
              yPos += 5
            }
          }

          // Build owner earnings table
          const yearsSet = new Set<number>()
          const allSeries = [ownerEarnings.net_income, ownerEarnings.depreciation, ownerEarnings.capex, ownerEarnings.owners_earnings]
          allSeries.forEach(s => { if (Array.isArray(s)) s.forEach(dp => yearsSet.add(dp.year)) })
          const sortedYears = Array.from(yearsSet).sort()

          const buildLookup = (s: Array<{ year: number; value: number }> | undefined) => {
            const m: Record<number, number> = {}
            if (Array.isArray(s)) s.forEach(dp => m[dp.year] = dp.value)
            return m
          }
          const niLookup = buildLookup(ownerEarnings.net_income)
          const depLookup = buildLookup(ownerEarnings.depreciation)
          const capexLookup = buildLookup(ownerEarnings.capex)
          const oeLookup = buildLookup(ownerEarnings.owners_earnings)

          autoTable(pdf, {
            startY: yPos,
            head: [['Year', 'Net Income', '+ D&A', '- CapEx', '= Owner Earnings']],
            body: sortedYears.map(year => [
              String(year),
              niLookup[year] != null ? formatCurrency(niLookup[year]) : '-',
              depLookup[year] != null ? formatCurrency(depLookup[year]) : '-',
              capexLookup[year] != null ? formatCurrency(capexLookup[year]) : '-',
              oeLookup[year] != null ? formatCurrency(oeLookup[year]) : '-',
            ]),
            theme: 'grid',
            headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, halign: 'right', font: 'courier' },
            columnStyles: { 0: { halign: 'left', font: 'helvetica' } },
            margin: { left: margin, right: margin },
          })
          yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
        }
      }
    }

    // === FINANCIAL CHARTS PAGE ===
    // Draws visual charts for income statement, margins, and cash flow
    {
      const chartFinancials = reportAllMetrics.financial_statements as Record<string, Record<string, Array<{ year: number; value: number }>>> | undefined
      const chartIncomeStatement = chartFinancials?.income_statement
      const chartCashFlow = chartFinancials?.cash_flow

      const hasChartableIncome = chartIncomeStatement?.revenue?.length && chartIncomeStatement.revenue.length >= 2
      const hasChartableMargins = chartIncomeStatement?.gross_margin?.length && chartIncomeStatement.gross_margin.length >= 2
      const hasChartableCF = chartCashFlow?.operating_cash_flow?.length && chartCashFlow.operating_cash_flow.length >= 2

      if (hasChartableIncome || hasChartableMargins || hasChartableCF) {
        pdf.addPage()
        yPos = margin

        // Page header
        pdf.setFontSize(20)
        pdf.setTextColor(...COLORS.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text(sanitizedTicker, margin, yPos)
        yPos += 8
        pdf.setFontSize(10)
        pdf.setTextColor(...COLORS.muted)
        pdf.text(subtitleParts.join(' | ') + ` | Analysis: ${analysisDate}`, margin, yPos)
        yPos += 8
        pdf.setDrawColor(...COLORS.light)
        pdf.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 8
        pdf.setFontSize(16)
        pdf.setTextColor(...COLORS.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Financial Charts', margin, yPos)
        yPos += 12

        const chartWidth = pageWidth - 2 * margin
        const chartHeight = 68

        // --- CHART 1: Revenue & Earnings ---
        if (hasChartableIncome) {
          const revenue = [...(chartIncomeStatement!.revenue || [])].sort((a, b) => a.year - b.year)
          const grossProfit = [...(chartIncomeStatement!.gross_profit || [])].sort((a, b) => a.year - b.year)
          const netIncome = [...(chartIncomeStatement!.net_income || [])].sort((a, b) => a.year - b.year)

          // Merge on years from revenue
          const years = revenue.map(d => d.year)
          const gpLookup: Record<number, number> = {}
          grossProfit.forEach(d => gpLookup[d.year] = d.value)
          const niLookup: Record<number, number> = {}
          netIncome.forEach(d => niLookup[d.year] = d.value)

          drawBarChart(
            pdf, margin, yPos, chartWidth, chartHeight,
            years.map(String),
            [
              { name: 'Revenue', values: years.map(y => revenue.find(d => d.year === y)?.value ?? 0), color: [59, 130, 246] },
              { name: 'Gross Profit', values: years.map(y => gpLookup[y] ?? 0), color: [34, 197, 94] },
              { name: 'Net Income', values: years.map(y => niLookup[y] ?? 0), color: [139, 92, 246] },
            ],
            'Revenue & Earnings Trend',
          )
          yPos += chartHeight + 8
        }

        // --- CHART 2: Margin Trends ---
        if (hasChartableMargins) {
          checkPageBreak(chartHeight + 10)
          const grossMargin = [...(chartIncomeStatement!.gross_margin || [])].sort((a, b) => a.year - b.year)
          const opMargin = [...(chartIncomeStatement!.operating_margin || [])].sort((a, b) => a.year - b.year)
          const netMargin = [...(chartIncomeStatement!.net_margin || [])].sort((a, b) => a.year - b.year)

          const years = grossMargin.map(d => d.year)
          const opLookup: Record<number, number> = {}
          opMargin.forEach(d => opLookup[d.year] = d.value)
          const nmLookup: Record<number, number> = {}
          netMargin.forEach(d => nmLookup[d.year] = d.value)

          drawLineChart(
            pdf, margin, yPos, chartWidth, chartHeight,
            years.map(String),
            [
              { name: 'Gross Margin', values: years.map(y => grossMargin.find(d => d.year === y)?.value ?? null), color: [59, 130, 246] },
              { name: 'Operating Margin', values: years.map(y => opLookup[y] ?? null), color: [249, 115, 22] },
              { name: 'Net Margin', values: years.map(y => nmLookup[y] ?? null), color: [139, 92, 246] },
            ],
            'Margin Trends',
            (v: number) => `${(v * 100).toFixed(0)}%`,
          )
          yPos += chartHeight + 8
        }

        // --- CHART 3: Cash Flow ---
        if (hasChartableCF) {
          checkPageBreak(chartHeight + 10)
          const opCF = [...(chartCashFlow!.operating_cash_flow || [])].sort((a, b) => a.year - b.year)
          const capex = [...(chartCashFlow!.capex || [])].sort((a, b) => a.year - b.year)
          const freeCF = [...(chartCashFlow!.free_cash_flow || [])].sort((a, b) => a.year - b.year)

          const years = opCF.map(d => d.year)
          const capexLookup: Record<number, number> = {}
          capex.forEach(d => capexLookup[d.year] = d.value)
          const fcfLookup: Record<number, number> = {}
          freeCF.forEach(d => fcfLookup[d.year] = d.value)

          drawBarChart(
            pdf, margin, yPos, chartWidth, chartHeight,
            years.map(String),
            [
              { name: 'Operating CF', values: years.map(y => opCF.find(d => d.year === y)?.value ?? 0), color: [59, 130, 246] },
              { name: 'CapEx', values: years.map(y => capexLookup[y] ?? 0), color: [239, 68, 68] },
              { name: 'Free CF', values: years.map(y => fcfLookup[y] ?? 0), color: [34, 197, 94] },
            ],
            'Cash Flow Breakdown',
          )
          yPos += chartHeight + 8
        }
      }
    }

    // === PAGE 3: FINANCIAL HEALTH & GROWTH METRICS ===
    const allMetrics = (stock.all_metrics || {}) as Record<string, unknown>
    const hasFinancialData = allMetrics.roe != null || allMetrics.roic != null || allMetrics.debt_to_equity != null
    const hasGrowthData = allMetrics.pe_ratio != null || allMetrics.peg_ratio != null || allMetrics.earnings_yield != null

    if (hasFinancialData || hasGrowthData) {
      pdf.addPage()
      yPos = margin

      // Header
      pdf.setFontSize(20)
      pdf.setTextColor(...COLORS.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text(sanitizedTicker, margin, yPos)
      yPos += 8

      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.muted)
      pdf.text(subtitleParts.join(' | ') + ` | Analysis: ${analysisDate}`, margin, yPos)
      yPos += 8

      pdf.setDrawColor(...COLORS.light)
      pdf.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 8

      pdf.setFontSize(16)
      pdf.setTextColor(...COLORS.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Financial Health & Growth Metrics', margin, yPos)
      yPos += 12

      const fmtPct = (v: unknown): string => {
        if (v == null || typeof v !== 'number' || !isFinite(v)) return 'N/A'
        return `${(v * 100).toFixed(1)}%`
      }
      const fmtRatio = (v: unknown): string => {
        if (v == null || typeof v !== 'number' || !isFinite(v)) return 'N/A'
        return v.toFixed(2)
      }
      const fmtMult = (v: unknown): string => {
        if (v == null || typeof v !== 'number' || !isFinite(v)) return 'N/A'
        return `${v.toFixed(1)}x`
      }

      if (hasFinancialData) {
        // Financial Health Table
        pdf.setFontSize(12)
        pdf.setTextColor(...COLORS.dark)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Financial Health', margin, yPos)
        yPos += 6

        autoTable(pdf, {
          startY: yPos,
          head: [['Metric', 'Value', 'Metric', 'Value']],
          body: [
            ['ROE', fmtPct(allMetrics.roe), 'Debt/Equity', fmtRatio(allMetrics.debt_to_equity)],
            ['ROIC', fmtPct(allMetrics.roic), 'Interest Coverage', fmtMult(allMetrics.interest_coverage)],
            ['Owner Earnings Yield', fmtPct(allMetrics.owner_earnings_yield), 'Current Ratio', fmtRatio(allMetrics.current_ratio)],
            ['Free Cash Flow', formatCurrency(allMetrics.free_cash_flow as number | null), 'Book Value/Share', formatCurrency(allMetrics.book_value_per_share as number | null)],
            ['Owner Earnings/Share', formatCurrency(allMetrics.owner_earnings_per_share as number | null), 'Net Cash/Share', formatCurrency(allMetrics.net_cash_per_share as number | null)],
          ],
          theme: 'grid',
          headStyles: {
            fillColor: COLORS.primary,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            fontSize: 9,
            halign: 'center'
          },
          columnStyles: {
            0: { fontStyle: 'bold', halign: 'left' },
            2: { fontStyle: 'bold', halign: 'left' }
          },
          margin: { left: margin, right: margin }
        })

        yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
      }

      // Quality Score Breakdown (from composite scoring)
      const qualBreakdown = reportAllMetrics.quality_breakdown as { total_score?: number; grade?: string; investment_style?: string; components?: Array<{ name: string; score: number; weight: number; weighted_score: number }> } | undefined
      if (qualBreakdown?.components && qualBreakdown.components.length > 0) {
        checkPageBreak(50)
        pdf.setFontSize(12)
        pdf.setTextColor(...COLORS.dark)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Quality Score Composition', margin, yPos)
        yPos += 6

        autoTable(pdf, {
          startY: yPos,
          head: [['Philosopher', 'Score', 'Weight', 'Contribution']],
          body: qualBreakdown.components.map(c => [
            c.name,
            `${c.score.toFixed(0)}/100`,
            `${(c.weight * 100).toFixed(0)}%`,
            c.weighted_score.toFixed(1)
          ]),
          foot: [[
            'Total',
            '',
            '100%',
            qualBreakdown.total_score?.toFixed(1) || 'N/A'
          ]],
          theme: 'grid',
          headStyles: {
            fillColor: COLORS.primary,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          },
          footStyles: {
            fillColor: COLORS.light,
            textColor: COLORS.dark,
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            fontSize: 9,
            halign: 'center'
          },
          columnStyles: {
            0: { fontStyle: 'bold', halign: 'left' }
          },
          margin: { left: margin, right: margin }
        })

        yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

        // --- CHART: Quality Score Radar ---
        if (qualBreakdown.components.length >= 3) {
          checkPageBreak(80)
          const radarData: RadarDataPoint[] = qualBreakdown.components.map(c => ({
            label: c.name,
            value: c.score,
            maxValue: 100,
          }))
          const radarRadius = 28
          drawRadarChart(
            pdf,
            margin + (pageWidth - 2 * margin) / 2, yPos + radarRadius + 10,
            radarRadius,
            radarData,
            'Quality Score Profile',
            [41, 128, 185],
          )
          yPos += radarRadius * 2 + 25
        }
      }

      if (hasGrowthData) {
        checkPageBreak(80)

        // Growth & Value Table
        pdf.setFontSize(12)
        pdf.setTextColor(...COLORS.dark)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Growth & Value Metrics', margin, yPos)
        yPos += 6

        autoTable(pdf, {
          startY: yPos,
          head: [['Metric', 'Value', 'Metric', 'Value']],
          body: [
            ['P/E Ratio', fmtRatio(allMetrics.pe_ratio), 'Earnings Yield', fmtPct(allMetrics.earnings_yield)],
            ['P/B Ratio', fmtRatio(allMetrics.pb_ratio), 'Return on Capital', fmtPct(allMetrics.return_on_capital)],
            ['PEG Ratio', fmtRatio(allMetrics.peg_ratio), 'Sales CAGR', fmtPct(allMetrics.sales_cagr)],
            ['Graham Score', allMetrics.graham_score != null ? `${Number(allMetrics.graham_score).toFixed(0)}/7` : 'N/A', 'Margin Trend', allMetrics.margin_trend != null ? String(allMetrics.margin_trend) : 'N/A'],
            ['EPS', formatCurrency(allMetrics.eps as number | null), 'Growth Quality', allMetrics.growth_quality_score != null ? `${Number(allMetrics.growth_quality_score).toFixed(0)}/100` : 'N/A'],
            ['Earnings Growth', fmtPct(allMetrics.earnings_growth), 'Lynch Category', allMetrics.lynch_category != null ? String(allMetrics.lynch_category) : 'N/A'],
          ],
          theme: 'grid',
          headStyles: {
            fillColor: COLORS.primary,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            fontSize: 9,
            halign: 'center'
          },
          columnStyles: {
            0: { fontStyle: 'bold', halign: 'left' },
            2: { fontStyle: 'bold', halign: 'left' }
          },
          margin: { left: margin, right: margin }
        })

        yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15
      }
    }

    // === PAGE 4: PERSPECTIVES (if available) ===
    const perspectives = stock.perspectives || []
    if (perspectives.length > 0) {
      pdf.addPage()
      yPos = margin

      // Header
      pdf.setFontSize(20)
      pdf.setTextColor(...COLORS.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text(sanitizedTicker, margin, yPos)
      yPos += 8

      pdf.setFontSize(10)
      pdf.setTextColor(...COLORS.muted)
      pdf.text(subtitleParts.join(' | ') + ` | Analysis: ${analysisDate}`, margin, yPos)
      yPos += 8

      pdf.setDrawColor(...COLORS.light)
      pdf.line(margin, yPos, pageWidth - margin, yPos)
      yPos += 8

      pdf.setFontSize(16)
      pdf.setTextColor(...COLORS.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Multi-Lens Analysis', margin, yPos)
      yPos += 12

      // Perspectives Table
      autoTable(pdf, {
        startY: yPos,
        head: [['Philosopher', 'Grade', 'Score', 'Verdict', 'Key Metric']],
        body: perspectives.map(p => [
          p.philosopher || 'Unknown',
          p.grade || 'N/A',
          p.score?.toString() || 'N/A',
          p.verdict || 'N/A',
          (p.key_metric || 'N/A').substring(0, 35)
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: COLORS.primary,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 9,
          halign: 'center'
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          4: { halign: 'left' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const grade = perspectives[data.row.index]?.grade
            if (grade && GRADE_COLORS[grade]) {
              data.cell.styles.textColor = GRADE_COLORS[grade]
            }
          }
        },
        margin: { left: margin, right: margin }
      })

      yPos = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12

      // Insights
      pdf.setFontSize(12)
      pdf.setTextColor(...COLORS.dark)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Investment Insights', margin, yPos)
      yPos += 8

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      for (const p of perspectives) {
        if (p.insight) {
          checkPageBreak(15)
          pdf.setTextColor(...COLORS.dark)
          pdf.setFont('helvetica', 'bold')
          pdf.text(`${p.philosopher} (${p.grade}):`, margin, yPos)
          yPos += 5

          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(...COLORS.muted)
          const lines = pdf.splitTextToSize(p.insight, pageWidth - (2 * margin) - 5)
          for (const line of lines) {
            checkPageBreak(5)
            pdf.text(line, margin + 5, yPos)
            yPos += 4
          }
          yPos += 3
        }
      }
    }

    // === FINAL PAGE: ACTION ITEMS & DISCLAIMER ===
    pdf.addPage()
    yPos = margin

    // Header
    pdf.setFontSize(20)
    pdf.setTextColor(...COLORS.primary)
    pdf.setFont('helvetica', 'bold')
    pdf.text(sanitizedTicker, margin, yPos)
    yPos += 8

    pdf.setFontSize(10)
    pdf.setTextColor(...COLORS.muted)
    pdf.text(subtitleParts.join(' | ') + ` | Analysis: ${analysisDate}`, margin, yPos)
    yPos += 8

    pdf.setDrawColor(...COLORS.light)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 8

    pdf.setFontSize(16)
    pdf.setTextColor(...COLORS.primary)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Action Items & Summary', margin, yPos)
    yPos += 12

    // Action Items
    pdf.setFontSize(12)
    pdf.setTextColor(...COLORS.dark)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Recommended Actions', margin, yPos)
    yPos += 8

    const actionItems = stock.action_items || []
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...COLORS.primary)

    if (actionItems.length > 0) {
      actionItems.forEach((action, i) => {
        checkPageBreak(6)
        pdf.text(`${i + 1}. ${action}`, margin + 5, yPos)
        yPos += 6
      })
    } else {
      // Default actions based on verdict
      const verdict = stock.verdict
      if (['STRONG BUY', 'BUY', 'ACCUMULATE'].includes(verdict)) {
        pdf.text('1. Consider initiating or adding to position', margin + 5, yPos)
        yPos += 6
        pdf.text('2. Review position sizing relative to portfolio', margin + 5, yPos)
        yPos += 6
      } else if (verdict === 'HOLD') {
        pdf.text('1. No action needed if already owned', margin + 5, yPos)
        yPos += 6
        pdf.text('2. Do not add at current prices', margin + 5, yPos)
        yPos += 6
      } else {
        pdf.text('1. Consider exiting position if owned', margin + 5, yPos)
        yPos += 6
        pdf.text('2. Look for better opportunities elsewhere', margin + 5, yPos)
        yPos += 6
      }
    }

    yPos += 15

    // Disclaimer
    pdf.setDrawColor(...COLORS.light)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 8

    pdf.setFontSize(8)
    pdf.setTextColor(...COLORS.muted)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Disclaimer:', margin, yPos)
    yPos += 4

    pdf.setFont('helvetica', 'normal')
    const disclaimerText = 'This report is generated by MOSEE for informational purposes only. It does not constitute financial advice, and should not be used as the sole basis for investment decisions. Past performance does not guarantee future results. Always conduct your own research and consult with a qualified financial advisor before making investment decisions.'
    const disclaimerLines = pdf.splitTextToSize(disclaimerText, pageWidth - (2 * margin))
    for (const line of disclaimerLines) {
      pdf.text(line, margin, yPos)
      yPos += 4
    }

    yPos += 10

    // Footer
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    pdf.setFontSize(8)
    pdf.setTextColor(...COLORS.muted)
    pdf.text(`Generated by MOSEE (Margin of Safety & Earnings to Equity Analyzer) | Report Date: ${reportDate}`, margin, yPos)

    // Convert to buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${sanitizedTicker}_MOSEE_Report.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Error generating report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
