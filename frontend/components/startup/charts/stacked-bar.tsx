"use client"

import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts"

const data = [
    { name: 'Week1', success: 4000, fail: 240 },
    { name: 'Week2', success: 3000, fail: 139 },
    { name: 'Week3', success: 2000, fail: 980 },
    { name: 'Week4', success: 2780, fail: 390 },
]

interface StackedBarChartProps {
    data?: any[]
    color1?: string
    color2?: string
}

export function StackedBarChart({ data: propData, color1 = "#22c55e", color2 = "#ef4444" }: StackedBarChartProps) {
    const chartData = propData || data
    return (
        <ResponsiveContainer width="100%" height={150}>
            <BarChart
                data={chartData}
                stackOffset="sign"
                margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            >
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="fail" stackId="a" fill={color2} barSize={40} />
                <Bar dataKey="success" stackId="a" fill={color1} barSize={40} radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    )
}
