import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon, Lightbulb, Fuel, UserMinus, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface InsightCardProps {
    type: "high" | "medium" | "low" | "neutral"
    icon?: LucideIcon
    title: string
    description: string
    actionLabel?: string
    onAction?: () => void
    tag?: string
}

export function InsightCard({ type, icon: Icon, title, description, actionLabel, tag }: InsightCardProps) {
    const getIconColor = () => {
        switch (type) {
            case "high": return "bg-red-100 text-red-600"
            case "medium": return "bg-orange-100 text-orange-600"
            case "low": return "bg-green-100 text-green-600"
            default: return "bg-gray-100 text-gray-600"
        }
    }

    const getTagColor = () => {
        switch (type) {
            case "high": return "bg-red-100 text-red-600 hover:bg-red-100"
            case "medium": return "bg-orange-100 text-orange-600 hover:bg-orange-100"
            case "low": return "bg-green-100 text-green-600 hover:bg-green-100"
            default: return "bg-gray-100 text-gray-600 hover:bg-gray-100"
        }
    }

    return (
        <Card>
            <CardContent className="p-6 flex gap-4">
                <div className={`p-3 rounded-lg h-fit ${getIconColor()}`}>
                    {Icon ? <Icon className="w-6 h-6" /> : <Lightbulb className="w-6 h-6" />}
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-foreground">{title}</h4>
                        {tag && <Badge variant="secondary" className={getTagColor()}>{tag}</Badge>}
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {description}
                    </p>
                    {actionLabel && (
                        <Button variant="secondary" size="sm" className="h-7 text-xs bg-slate-900 text-white hover:bg-slate-800">
                            {actionLabel}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
