"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const funnelData = [
    { stage: "Signups", userCount: "12,500", conversionRate: "-", dropOffRate: "-" },
    { stage: "Activation", userCount: "4,357", conversionRate: "35.00%", dropOffRate: "65.00%", dropOffColor: "text-red-500" },
    { stage: "First-Week Retention", userCount: "3,112", conversionRate: "71.42%", dropOffRate: "28.58%", dropOffColor: "text-red-500" },
    { stage: "Monetization", userCount: "2,162", conversionRate: "84.00%", dropOffRate: "16.00%", dropOffColor: "text-red-500" },
]

export function FunnelTable() {
    return (
        <div className="rounded-md border mt-8">
            <div className="p-4 bg-muted/5 border-b">
                <h3 className="font-semibold text-sm">Top Countries & Drop-off Rate</h3>
            </div>
            <Table>
                <TableHeader className="bg-muted/5">
                    <TableRow>
                        <TableHead className="font-medium text-xs text-muted-foreground">Stage</TableHead>
                        <TableHead className="font-medium text-xs text-muted-foreground">User Count</TableHead>
                        <TableHead className="font-medium text-xs text-muted-foreground">Conversion Rate</TableHead>
                        <TableHead className="font-medium text-xs text-muted-foreground">Drop-off Rate</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {funnelData.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium text-sm text-muted-foreground">{item.stage}</TableCell>
                            <TableCell className="text-sm text-foreground">{item.userCount}</TableCell>
                            <TableCell className="text-sm text-foreground">{item.conversionRate}</TableCell>
                            <TableCell className={`text-sm ${item.dropOffColor || "text-muted-foreground"}`}>{item.dropOffRate}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
