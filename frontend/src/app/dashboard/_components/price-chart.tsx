import { GRACE_PERIOD_CAPTION } from '@/constants/copy';
import type { PricePoint } from '@/types';
import { formatUsd } from '@/utils/format';

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PADDING = 16;

interface PriceChartProps {
  points: PricePoint[];
  defensePrice: number;
  protectionFloorPrice: number;
}

interface ChartScale {
  min: number;
  max: number;
  toY: (price: number) => number;
  toX: (index: number, total: number) => number;
}

function buildScale(prices: number[]): ChartScale {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const usableHeight = CHART_HEIGHT - CHART_PADDING * 2;

  return {
    min,
    max,
    toY: (price) => CHART_PADDING + usableHeight * (1 - (price - min) / span),
    toX: (index, total) =>
      CHART_PADDING + ((CHART_WIDTH - CHART_PADDING * 2) * index) / Math.max(1, total - 1),
  };
}

function ThresholdLine({ y, stroke, label }: { y: number; stroke: string; label: string }) {
  return (
    <g>
      <line
        x1={CHART_PADDING}
        y1={y}
        x2={CHART_WIDTH - CHART_PADDING}
        y2={y}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      <text x={CHART_PADDING + 4} y={y - 6} fill={stroke} style={{ fontSize: 11 }}>
        {label}
      </text>
    </g>
  );
}

export function PriceChart({ points, defensePrice, protectionFloorPrice }: PriceChartProps) {
  if (points.length === 0) return null;

  const prices = [...points.map((point) => point.price), defensePrice, protectionFloorPrice].filter(
    (price) => Number.isFinite(price),
  );
  const scale = buildScale(prices);
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scale.toX(index, points.length)} ${scale.toY(point.price)}`)
    .join(' ');

  return (
    <figure className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full rounded-lg border-2 border-line bg-surface shadow-card"
        role="img"
        aria-label={`Collateral price history from ${formatUsd(points[0].price)} to ${formatUsd(points[points.length - 1].price)}`}
      >
        <ThresholdLine
          y={scale.toY(defensePrice)}
          stroke="var(--color-defending)"
          label={`defence price ${formatUsd(defensePrice)}`}
        />
        <ThresholdLine
          y={scale.toY(protectionFloorPrice)}
          stroke="var(--color-critical)"
          label={`protection floor ${formatUsd(protectionFloorPrice)}`}
        />
        <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth={2.5} />
      </svg>
      <figcaption className="max-w-prose text-sm text-ink-muted">{GRACE_PERIOD_CAPTION}</figcaption>
    </figure>
  );
}
