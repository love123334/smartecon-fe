import type { ChartOptions } from 'chart.js'

/** Palette SEDSP — navy + blue, dễ đọc trên nền trắng */
export const CHART_COLORS = {
  primary: '#2e7df6',
  primarySoft: 'rgba(46, 125, 246, 0.14)',
  secondary: '#14275c',
  success: '#38cb89',
  successSoft: 'rgba(56, 203, 137, 0.16)',
  warn: '#f59e0b',
  warnSoft: 'rgba(245, 158, 11, 0.16)',
  grid: 'rgba(20, 39, 92, 0.06)',
  gridStrong: 'rgba(20, 39, 92, 0.1)',
  tick: '#5b6c93',
  tooltipBg: 'rgba(20, 39, 92, 0.94)',
} as const

const baseFont = {
  family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  size: 12,
}

function sharedOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 720,
      easing: 'easeOutQuart' as const,
    },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: CHART_COLORS.tick,
          font: { ...baseFont, size: 11 },
          padding: 14,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: CHART_COLORS.tooltipBg,
        titleFont: { ...baseFont, weight: 600 },
        bodyFont: baseFont,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        ticks: { color: CHART_COLORS.tick, font: baseFont, maxRotation: 0 },
        grid: { color: CHART_COLORS.grid },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: CHART_COLORS.tick, font: baseFont },
        grid: { color: CHART_COLORS.gridStrong },
        border: { display: false },
      },
    },
  }
}

/** Options chung cho biểu đồ đường */
export function baseLineChartOptions(overrides?: ChartOptions<'line'>): ChartOptions<'line'> {
  const base = sharedOptions()
  return {
    ...base,
    ...overrides,
    plugins: {
      ...base.plugins,
      ...overrides?.plugins,
      legend: { ...base.plugins.legend, ...overrides?.plugins?.legend },
      tooltip: { ...base.plugins.tooltip, ...overrides?.plugins?.tooltip },
    },
    scales: {
      ...base.scales,
      ...overrides?.scales,
      x: { ...base.scales.x, ...overrides?.scales?.x },
      y: { ...base.scales.y, ...overrides?.scales?.y },
    },
  }
}

/** Options chung cho biểu đồ cột */
export function baseBarChartOptions(overrides?: ChartOptions<'bar'>): ChartOptions<'bar'> {
  const base = sharedOptions()
  return {
    ...base,
    ...overrides,
    plugins: {
      ...base.plugins,
      ...overrides?.plugins,
      legend: { ...base.plugins.legend, ...overrides?.plugins?.legend },
      tooltip: { ...base.plugins.tooltip, ...overrides?.plugins?.tooltip },
    },
    scales: {
      ...base.scales,
      ...overrides?.scales,
      x: { ...base.scales.x, ...overrides?.scales?.x },
      y: { ...base.scales.y, ...overrides?.scales?.y },
    },
  }
}

/** @deprecated dùng baseLineChartOptions hoặc baseBarChartOptions */
export const baseChartOptions = baseLineChartOptions
