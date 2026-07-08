"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Renders a ```chart fenced block. Expected JSON:
//   { "type":"bar"|"line"|"area"|"pie", "title"?:string,
//     "x":"categoryKey", "series":["k1","k2"], "data":[{...}] }         (bar/line/area)
//   { "type":"pie", "nameKey":"label", "valueKey":"value", "data":[{...}] } (pie)
interface ChartSpec {
  type?: "bar" | "line" | "area" | "pie";
  title?: string;
  x?: string;
  series?: string[];
  nameKey?: string;
  valueKey?: string;
  data?: Record<string, unknown>[];
}

const COLORS = ["#A855F7", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#14b8a6", "#ec4899"];
const AXIS = "hsl(var(--text-tertiary))";
const GRID = "hsl(var(--border))";

export function ChartBlock({ code }: { code: string }) {
  const spec = useMemo<ChartSpec | null>(() => {
    try {
      return JSON.parse(code) as ChartSpec;
    } catch {
      return null;
    }
  }, [code]);

  if (!spec || !Array.isArray(spec.data) || spec.data.length === 0) {
    return (
      <div className="my-4 rounded-xl border border-error/30 bg-error/5 p-3 text-[12px] text-error">
        Invalid chart data.
        <pre className="mt-1 overflow-x-auto text-text-tertiary">{code}</pre>
      </div>
    );
  }

  const type = spec.type ?? "bar";
  const data = spec.data;
  const x = spec.x ?? Object.keys(data[0])[0];

  // Series: explicit, else every numeric key that isn't the x key.
  const series =
    spec.series && spec.series.length
      ? spec.series
      : Object.keys(data[0]).filter(
          (k) => k !== x && typeof data[0][k] === "number"
        );

  const tooltip = (
    <Tooltip
      contentStyle={{
        background: "hsl(var(--elevated))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 10,
        fontSize: 12,
      }}
    />
  );

  return (
    <figure className="my-4 rounded-xl border border-border/70 bg-surface p-3">
      {spec.title && (
        <figcaption className="mb-2 px-1 text-[13px] font-semibold text-foreground">
          {spec.title}
        </figcaption>
      )}
      <ResponsiveContainer width="100%" height={280}>
        {type === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={spec.valueKey ?? "value"}
              nameKey={spec.nameKey ?? "label"}
              outerRadius={100}
              label
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            {tooltip}
            <Legend />
          </PieChart>
        ) : type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey={x} stroke={AXIS} fontSize={11} />
            <YAxis stroke={AXIS} fontSize={11} />
            {tooltip}
            {series.length > 1 && <Legend />}
            {series.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : type === "area" ? (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey={x} stroke={AXIS} fontSize={11} />
            <YAxis stroke={AXIS} fontSize={11} />
            {tooltip}
            {series.length > 1 && <Legend />}
            {series.map((s, i) => (
              <Area key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey={x} stroke={AXIS} fontSize={11} />
            <YAxis stroke={AXIS} fontSize={11} />
            {tooltip}
            {series.length > 1 && <Legend />}
            {series.map((s, i) => (
              <Bar key={s} dataKey={s} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </figure>
  );
}
