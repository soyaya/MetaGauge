"use client"

import { LineChart, Line, ResponsiveContainer } from "recharts"

interface SparkLineProps {
    data: any[]
    color?: string
}

export function SparkLine({ data, color = "#22c55e" }: SparkLineProps) {
    return (
        <div className="h-[40px] w-[80px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
