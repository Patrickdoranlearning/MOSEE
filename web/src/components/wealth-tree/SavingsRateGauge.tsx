'use client'

interface SavingsRateGaugeProps {
  actualRate: number   // decimal: 0.15 = 15%
  targetRate: number   // decimal: 0.10 = 10%
  size?: number        // px, default 160
}

export function SavingsRateGauge({
  actualRate,
  targetRate,
  size = 160,
}: SavingsRateGaugeProps) {
  const progress = targetRate > 0 ? actualRate / targetRate : 0
  const clampedProgress = Math.min(progress, 1.5) // cap visual at 150%
  const displayPercent = (actualRate * 100).toFixed(1)

  // Color based on progress toward target
  const getColor = (): string => {
    if (progress >= 1) return '#16a34a'   // green-600
    if (progress >= 0.5) return '#ca8a04' // yellow-600
    return '#dc2626'                       // red-600
  }

  const getTextColorClass = (): string => {
    if (progress >= 1) return 'text-green-600'
    if (progress >= 0.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const color = getColor()

  // SVG arc calculations
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  // Use 270 degrees of arc (3/4 circle) starting from bottom-left
  const arcLength = circumference * 0.75
  const filledLength = arcLength * Math.min(clampedProgress, 1)
  const emptyLength = arcLength - filledLength

  // Rotation to start arc from bottom-left (135 degrees from top)
  const startAngle = 135

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Background arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${center} ${center})`}
        />
        {/* Filled arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filledLength} ${emptyLength + (circumference - arcLength)}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${center} ${center})`}
          className="transition-all duration-700 ease-out"
        />
        {/* Center text */}
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className={`${getTextColorClass()} font-bold`}
          style={{ fontSize: size * 0.18 }}
        >
          {displayPercent}%
        </text>
        <text
          x={center}
          y={center + size * 0.14}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-400"
          style={{ fontSize: size * 0.09 }}
        >
          of {(targetRate * 100).toFixed(0)}% target
        </text>
      </svg>
    </div>
  )
}
