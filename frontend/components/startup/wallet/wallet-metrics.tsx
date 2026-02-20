"use client"

import { Card, CardContent } from "@/components/ui/card"

export function WalletMetrics() {
    return (
        <div className="grid grid-cols-4 gap-6">
            <Card><CardContent className="p-6">
                <div className="text-xs text-muted-foreground mb-1">Active wallet</div>
                <div className="flex items-end gap-2 mb-1">
                    <div className="text-3xl font-bold text-green-600">1,247</div>
                    <div className="text-[10px] text-green-500 mb-1">↗ 12.5%</div>
                </div>
                <div className="text-[10px] text-muted-foreground">vs Last Month</div>
            </CardContent></Card>

            <Card><CardContent className="p-6">
                <div className="text-xs text-muted-foreground mb-1">Total Volume</div>
                <div className="flex items-end gap-2 mb-1">
                    <div className="text-3xl font-bold text-green-600">$2.4M</div>
                    <div className="text-[10px] text-green-500 mb-1">↗ 15.5%</div>
                </div>
                <div className="text-[10px] text-muted-foreground">in transactions</div>
            </CardContent></Card>

            <Card><CardContent className="p-6">
                <div className="text-xs text-muted-foreground mb-1">Aug Gas Fee</div>
                <div className="flex items-end gap-2 mb-1">
                    <div className="text-3xl font-bold text-red-500">$12.40</div>
                    <div className="text-[10px] text-red-400 mb-1">↘ 12.5%</div>
                </div>
                <div className="text-[10px] text-muted-foreground">52% above competitors</div>
            </CardContent></Card>

            <Card><CardContent className="p-6">
                <div className="text-xs text-muted-foreground mb-1">Failed Tx Rate</div>
                <div className="flex items-end gap-2 mb-1">
                    <div className="text-3xl font-bold text-red-500">8.5%</div>
                </div>
                <div className="text-[10px] text-muted-foreground">Needs Improvement</div>
            </CardContent></Card>
        </div>
    )
}
