"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts"

const data = [
    { month: "Jan", product: 3200, competitor: 3600, median: 3500 },
    { month: "Feb", product: 3700, competitor: 4200, median: 3550 },
    { month: "Mar", product: 3500, competitor: 4400, median: 3600 },
    { month: "Apr", product: 4200, competitor: 4800, median: 3650 },
    { month: "May", product: 4000, competitor: 4900, median: 3700 },
    { month: "Jun", product: 4800, competitor: 5600, median: 3750 },
]

export function TrendChart() {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e5e7eb" />
                <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    stroke="#6b7280"
                    fontSize={12}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    stroke="#6b7280"
                    fontSize={12}
                />
                <Tooltip
                    contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />

                <Line
                    type="monotone"
                    dataKey="product"
                    name="Your Product"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                />
                <Line
                    type="monotone"
                    dataKey="competitor"
                    name="Top Competitor"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                />
                <Line
                    type="monotone"
                    dataKey="median"
                    name="Industry Median"
                    stroke="#eab308"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    )
}
