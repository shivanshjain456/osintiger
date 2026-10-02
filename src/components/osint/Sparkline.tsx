"use client";

// Mini sparkline — shows a series of values as a tiny inline SVG line/bars.
// Used in report headers to visualize finding confidence distribution.
export function Sparkline({
  values,
  width = 100,
  height = 24,
  color = "#00ff41",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length === 0) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / Math.max(1, values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <defs>
        <linearGradient id={`spark-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-${color.slice(1)})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.length <= 20 &&
        values.map((v, i) => {
          const x = i * step;
          const y = height - ((v - min) / range) * height;
          return <circle key={i} cx={x} cy={y} r="1.2" fill={color} />;
        })}
    </svg>
  );
}
