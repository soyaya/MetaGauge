import { Card, CardContent } from "@/components/ui/card"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

interface MetricCardProps {
    title: string
    value: string
    change?: string
    trend?: "up" | "down" | "neutral"
    subtext?: string
}

export function MetricCard({ title, value, change, trend, subtext }: MetricCardProps) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    {change && (
                        <div className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${trend === "up" ? "bg-green-100 text-green-700" :
                                trend === "down" ? "bg-red-100 text-red-700" :
                                    "bg-gray-100 text-gray-700"
                            }`}>
                            {trend === "up" && <ArrowUp className="w-3 h-3 mr-1" />}
                            {trend === "down" && <ArrowDown className="w-3 h-3 mr-1" />}
                            {trend === "neutral" && <Minus className="w-3 h-3 mr-1" />}
                            {change}
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <div className="text-2xl font-bold">{value}</div>
                    {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
                </div>
            </CardContent>
        </Card>
    )
}
