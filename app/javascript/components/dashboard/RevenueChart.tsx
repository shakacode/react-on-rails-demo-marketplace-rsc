// Server component — d3 stays server-side in RSC, only SVG goes to client.
// Use scaleUtc + utcFormat (not scaleTime + timeFormat) so server-rendered tick
// positions and labels match the browser's hydration. scaleTime ticks at local-
// timezone midnights — when the server runs in UTC and the browser is GMT+N,
// the two compute different tick sets and React throws hydration error #418.
import React from 'react';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { area, line, curveMonotoneX } from 'd3-shape';
import { extent, max } from 'd3-array';
import { utcFormat } from 'd3-time-format';
import type { RevenueDataPoint } from '../../types/dashboard';

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

const WIDTH = 720;
const HEIGHT = 300;
const MARGIN = { top: 20, right: 20, bottom: 40, left: 60 };
const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

const formatDate = utcFormat('%b %d');
const formatDateShort = utcFormat('%d');

export default function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) return null;

  const parsed = data.map(d => ({ ...d, dateObj: new Date(d.date) }));

  const xDomain = extent(parsed, d => d.dateObj) as [Date, Date];
  const yMax = max(parsed, d => d.revenue) || 0;

  const xScale = scaleUtc().domain(xDomain).range([0, INNER_W]);
  const yScale = scaleLinear().domain([0, yMax * 1.1]).range([INNER_H, 0]).nice();

  const areaGen = area<(typeof parsed)[0]>()
    .x(d => xScale(d.dateObj))
    .y0(INNER_H)
    .y1(d => yScale(d.revenue))
    .curve(curveMonotoneX);

  const lineGen = line<(typeof parsed)[0]>()
    .x(d => xScale(d.dateObj))
    .y(d => yScale(d.revenue))
    .curve(curveMonotoneX);

  const areaPath = areaGen(parsed) || '';
  const linePath = lineGen(parsed) || '';

  const yTicks = yScale.ticks(5);
  const xTicks = xScale.ticks(Math.min(data.length, 8));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Revenue Over Time</h3>
        <span className="text-sm text-gray-500">Last 30 days</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="Revenue chart">
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Grid lines */}
          {yTicks.map(tick => (
            <line
              key={tick}
              x1={0}
              x2={INNER_W}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
          ))}
          {/* Area fill */}
          <path d={areaPath} fill="url(#revenueGradient)" />
          {/* Line */}
          <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2.5} />
          {/* Data points */}
          {parsed.map((d, i) => (
            <circle
              key={i}
              cx={xScale(d.dateObj)}
              cy={yScale(d.revenue)}
              r={data.length <= 15 ? 3.5 : 0}
              fill="#6366f1"
              stroke="white"
              strokeWidth={2}
            />
          ))}
          {/* Y axis labels */}
          {yTicks.map(tick => (
            <text
              key={tick}
              x={-10}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-gray-400"
              fontSize={11}
            >
              ${(tick / 1000).toFixed(0)}k
            </text>
          ))}
          {/* X axis labels */}
          {xTicks.map((tick, i) => (
            <text
              key={i}
              x={xScale(tick)}
              y={INNER_H + 28}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize={11}
            >
              {data.length > 15 ? formatDateShort(tick) : formatDate(tick)}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
