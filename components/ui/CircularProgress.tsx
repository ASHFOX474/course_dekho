/**
 * A circular ("donut") progress indicator, drawn with plain SVG.
 * Used for the topic-completion circle on the roadmap page and the
 * "Overall Progress" ring on the My Progress page.
 */
export function CircularProgress({
  percent,
  size = 80,
  strokeWidth = 8,
  label,
  sublabel,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
        />
        {/* progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-violet-600 transition-all"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-slate-900">{label ?? `${percent}%`}</span>
        {sublabel && <span className="text-[10px] font-medium text-slate-400">{sublabel}</span>}
      </div>
    </div>
  );
}
