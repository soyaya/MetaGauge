"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from "recharts"

const data = [
    { name: "Day 1", value: 100 },
    { name: "Day 2", value: 85 },
    { name: "Day 3", value: 70 },
    { name: "Day 4", value: 60 },
    { name: "Day 5", value: 55 },
    { name: "Day 6", value: 50 },
    { name: "Day 7", value: 45 },
]

interface CohortChartProps {
    data?: any[]
    color?: string
}

export function CohortChart({ data: promptData, color = "#22c55e" }: CohortChartProps) {
    const chartData = promptData || data

    return (
        <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData}>
                <XAxis
                    dataKey="name"
                    hide
                    axisLine={false}
                    tickLine={false}
                />
                <Tooltip
                    cursor={{ fill: 'transparent' }}
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col">
                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                Value
                                            </span>
                                            <span className="font-bold text-muted-foreground">
                                                {payload[0].value}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                        return null
                    }}
                />
                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
        </ResponsiveContainer>
    )
}
