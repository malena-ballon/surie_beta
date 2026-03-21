"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const data = [
  { month: "Aug", mastery: 45 },
  { month: "Sep", mastery: 48 },
  { month: "Oct", mastery: 52 },
  { month: "Nov", mastery: 55 },
  { month: "Jan", mastery: 59 },
  { month: "Mar", mastery: 62 },
]

export function PerformanceChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="masteryGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#0072C6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#0072C6" stopOpacity={0}   />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#E8E6E1"
          strokeOpacity={0.6}
          vertical={false}
        />

        <XAxis
          dataKey="month"
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

        <Tooltip
          contentStyle={{
            backgroundColor: "#1A1A2E",
            border: "none",
            borderRadius: "10px",
            boxShadow: "0 10px 15px -3px rgba(30,25,18,0.08)",
            color: "#fff",
            fontSize: 13,
            fontFamily: "Plus Jakarta Sans",
          }}
          itemStyle={{ color: "#fff" }}
          formatter={(value) => [`${value}%`, "Mastery Rate"]}
          cursor={{ stroke: "#0072C6", strokeWidth: 1, strokeDasharray: "4 2" }}
        />

        <Area
          type="monotone"
          dataKey="mastery"
          stroke="#0072C6"
          strokeWidth={2.5}
          fill="url(#masteryGradient)"
          dot={{ fill: "#fff", stroke: "#0072C6", strokeWidth: 2, r: 5 }}
          activeDot={{ r: 7, fill: "#fff", stroke: "#0072C6", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
