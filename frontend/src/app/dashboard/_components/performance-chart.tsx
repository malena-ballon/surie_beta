"use client"

import { useState, useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { ClassPerformanceTrend } from "@/lib/api"

const LINE_COLORS = [
  "#0072C6",
  "#9B59B6",
  "#E67E22",
  "#2ECC71",
  "#E74C3C",
  "#1ABC9C",
  "#3498DB",
  "#F39C12",
]

interface Props {
  trend: ClassPerformanceTrend[]
}

// Merge all class data into a single array of points keyed by date
function buildChartData(trend: ClassPerformanceTrend[]) {
  const dateMap = new Map<string, Record<string, unknown>>()

  for (const cls of trend) {
    for (const pt of cls.data) {
      if (!dateMap.has(pt.date)) {
        dateMap.set(pt.date, { label: pt.label, date: pt.date })
      }
      const row = dateMap.get(pt.date)!
      row[cls.class_name] = pt.mastery
      // store title for tooltip lookup
      row[`__title__${cls.class_name}`] = pt.title
    }
  }

  return Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
  )
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string; payload: Record<string, unknown> }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      style={{
        backgroundColor: "#1A1A2E",
        border: "none",
        borderRadius: "10px",
        padding: "10px 14px",
        boxShadow: "0 10px 15px -3px rgba(30,25,18,0.12)",
        fontSize: 12,
        fontFamily: "Plus Jakarta Sans",
        color: "#fff",
        minWidth: 160,
      }}
    >
      <p style={{ marginBottom: 6, color: "#9B9794", fontSize: 11 }}>{label}</p>
      {payload.map((entry) => {
        const title = entry.payload[`__title__${entry.dataKey}`] as string | undefined
        return (
          <div key={entry.dataKey} style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: entry.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#E8E6E1", fontWeight: 600 }}>{entry.value}%</span>
              <span style={{ color: "#9B9794", fontSize: 11 }}>mastery</span>
            </div>
            {title && (
              <p style={{ color: "#9B9794", fontSize: 10, marginLeft: 14, marginTop: 1 }}>
                {title}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function PerformanceChart({ trend }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const chartData = useMemo(() => buildChartData(trend), [trend])
  const classNames = useMemo(() => trend.map((c) => c.class_name), [trend])

  function toggleClass(name: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px]">
        <p className="text-sm text-ink-tertiary">No trend data yet — generate diagnostics to see progress.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Toggleable legend (only shown when multiple classes) */}
      {classNames.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {classNames.map((name, i) => {
            const color = LINE_COLORS[i % LINE_COLORS.length]
            const isHidden = hidden.has(name)
            return (
              <button
                key={name}
                onClick={() => toggleClass(name)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-opacity"
                style={{
                  borderColor: isHidden ? "#E8E6E1" : color,
                  color: isHidden ? "#9B9794" : color,
                  opacity: isHidden ? 0.5 : 1,
                  backgroundColor: isHidden ? "transparent" : `${color}10`,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: isHidden ? "#9B9794" : color,
                    display: "inline-block",
                  }}
                />
                {name}
              </button>
            )
          })}
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E8E6E1"
            strokeOpacity={0.6}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8E8E9E", fontSize: 12, fontFamily: "Plus Jakarta Sans" }}
            dy={8}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8E8E9E", fontSize: 12, fontFamily: "Plus Jakarta Sans" }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#0072C6", strokeWidth: 1, strokeDasharray: "4 2" }} />

          {classNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2.5}
              dot={{ fill: "#fff", stroke: LINE_COLORS[i % LINE_COLORS.length], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: "#fff", stroke: LINE_COLORS[i % LINE_COLORS.length], strokeWidth: 2 }}
              connectNulls
              hide={hidden.has(name)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
