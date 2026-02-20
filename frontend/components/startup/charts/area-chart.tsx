"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const data = [
    { name: "Jan", uv: 4000, pv: 2400, amt: 2400 },
    { name: "Feb", uv: 3000, pv: 1398, amt: 2210 },
    { name: "Mar", uv: 2000, pv: 9800, amt: 2290 },
    { name: "Apr", uv: 2780, pv: 3908, amt: 2000 },
    { name: "May", uv: 1890, pv: 4800, amt: 2181 },
    { name: "Jun", uv: 2390, pv: 3800, amt: 2500 },
    { name: "Jul", uv: 3490, pv: 4300, amt: 2100 },
]

interface SimpleAreaChartProps {
    data?: any[]
    color?: string
    height?: number
    showAxes?: boolean
    showGrid?: boolean
}

export function SimpleAreaChart({ data: propData, color = "#22c55e", height = 200, showAxes = false, showGrid = false }: SimpleAreaChartProps) {
    const chartData = propData || data

    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart
                data={chartData}
                margin={{
                    top: 5,
                    right: 0,
                    left: 0,
                    bottom: 0,
                }}
            >
                {showGrid && <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />}
                {showAxes && <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />}
                {showAxes && <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />}
                <Tooltip />
                <defs>
                    <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#gradient-${color})`} />
            </AreaChart>
        </ResponsiveContainer>
    )
}
