import type { TrendBucket } from "../../api/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface TrendChartProps {
  trend: TrendBucket[];
  loading: boolean;
}

export function TrendChart({ trend, loading }: TrendChartProps) {
  if (loading && !trend?.length) {
    return <LoadingBox />;
  }

  if (!trend?.length) {
    return null;
  }

  const data = trend.map((b) => ({
    date: b.date,
    clean: b.clean,
    warned: b.warned,
    flagged: b.flagged,
    error: b.error,
    total: b.count,
  }));

  return (
    <Card className="col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Tren Harian</CardTitle>
        <CardDescription className="text-xs">Volume pesan per hari dengan status moderasi.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Total</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Clean</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Warned</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Flagged</span>
          </div>
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <svg viewBox={`0 0 ${Math.max(data.length - 1, 1)} 100`} className="h-55 w-full overflow-visible">
              <g stroke="#334155" strokeWidth="0.5" opacity="0.6">
                {Array.from({ length: 5 }, (_, index) => {
                  const y = (index / 4) * 100;
                  return <line key={index} x1="0" x2={Math.max(data.length - 1, 1)} y1={y} y2={y} />;
                })}
              </g>
              <TrendPath data={data} color="#3b82f6" strokeWidth={2} keyName="total" />
              <TrendPath data={data} color="#10b981" strokeWidth={1.5} keyName="clean" />
              <TrendPath data={data} color="#f59e0b" strokeWidth={1.5} keyName="warned" />
              <TrendPath data={data} color="#ef4444" strokeWidth={1.5} keyName="flagged" />
            </svg>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
              {data.map((item) => (
                <div key={item.date} className="truncate rounded-lg bg-muted/30 px-2 py-1 text-center">
                  {item.date.slice(5)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendPath({
  data,
  color,
  strokeWidth,
  keyName,
}: {
  data: Array<Record<string, number | string>>;
  color: string;
  strokeWidth: number;
  keyName: string;
}) {
  const values = data.map((item) => Number(item[keyName] ?? 0));
  const maxValue = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * 100;
    const y = 100 - (value / maxValue) * 90 - 5;
    return `${x},${y}`;
  });

  return <polyline fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" points={points.join(" ")} />;
}

function LoadingBox() {
  return (
    <Card className="col-span-3">
      <CardContent className="flex h-65 items-center justify-center text-sm text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="ml-2">Memuat data...</span>
      </CardContent>
    </Card>
  );
}
