"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

const data = [
    { name: "Swap (40%)", value: 400, color: "#3b82f6" },
    { name: "Bridge (30%)", value: 300, color: "#f97316" },
    { name: "Transfer (20%)", value: 200, color: "#22c55e" },
    { name: "Other (10%)", value: 100, color: "#eab308" },
]

interface DonutChartProps {
    data?: any[]
    centerLabel?: string
    centerSub?: string
    innerRadius?: number
    outerRadius?: number
}

export function DonutChart({ data: propData, centerLabel, centerSub, innerRadius = 60, outerRadius = 80 }: DonutChartProps) {
    const chartData = propData || data

    return (
        <div className="h-[200px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={innerRadius}
                        outerRadius={outerRadius}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '12px' }}
                    />
                </PieChart>
            </ResponsiveContainer>

            {/* Center Label for Donut */}
            {(centerLabel || centerSub) && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    {centerLabel && <div className="text-2xl font-bold">{centerLabel}</div>}
                    {centerSub && <div className="text-[10px] font-medium text-muted-foreground uppercase">{centerSub}</div>}
                </div>
            )}
        </div>
    )
}
