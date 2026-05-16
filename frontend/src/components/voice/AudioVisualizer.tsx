interface AudioVisualizerProps {
  levels: number[];
}

export function AudioVisualizer({ levels }: AudioVisualizerProps) {
  const bars = levels.length ? levels : Array.from({ length: 32 }, () => 0.04);
  return (
    <div className="flex h-40 items-end gap-1 rounded-2xl border border-border bg-background/60 p-4">
      {bars.map((level, index) => (
        <div
          key={`${index}-${level}`}
          className="flex-1 rounded-full bg-gradient-to-t from-primary/50 to-cyan-300 transition-all duration-150"
          style={{ height: `${Math.max(6, Math.min(100, level * 100))}%` }}
        />
      ))}
    </div>
  );
}
