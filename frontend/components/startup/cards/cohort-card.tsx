import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CohortChart } from "@/components/startup/charts/cohort-chart"
import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react"

interface CohortCardProps {
    title: string
    subtitle: string
    riskLevel: "Low Risk" | "Medium Risk" | "High Risk"
    users: string
    retention: string
    revenue: string
    platform?: string
    chartData?: any[]
    dotColor?: string
}

export function CohortCard({ title, subtitle, riskLevel, users, retention, revenue, platform, chartData, dotColor = "#22c55e" }: CohortCardProps) {
    const riskColor =
        riskLevel === "Low Risk" ? "text-green-600" :
            riskLevel === "Medium Risk" ? "text-orange-600" : "text-red-600"

    const RiskIcon =
        riskLevel === "Low Risk" ? CheckCircle2 :
            riskLevel === "Medium Risk" ? AlertCircle : AlertTriangle

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-2`} style={{ backgroundColor: dotColor }} />
                        <div>
                            <h3 className="font-semibold text-base">{title}</h3>
                            <p className="text-sm text-muted-foreground">{subtitle}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${riskColor}`}>
                        <RiskIcon className="w-3.5 h-3.5" />
                        {riskLevel}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">User</p>
                        <p className="font-semibold">{users}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Retention</p>
                        <p className={`font-semibold ${parseInt(retention) > 50 ? 'text-green-600' : 'text-orange-600'}`}>{retention}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span className="font-medium text-amber-500">{revenue} Revenue</span>
                    {platform && <span className="bg-muted px-2 py-0.5 rounded text-[10px] uppercase">{platform}</span>}
                </div>

                <div className="h-16">
                    <CohortChart data={chartData} color={dotColor} />
                </div>
            </CardContent>
        </Card>
    )
}
