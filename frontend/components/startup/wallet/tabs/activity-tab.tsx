"use client"

import { Card, CardContent } from "@/components/ui/card"
import { WalletTab } from "./wallet-tab" // Reusing the table from WalletTab as the image shows the same table structure at bottom
// Actually the bottom table is "Recent Active Wallet", same structure.

export function ActivityTab() {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 gap-8">
                {/* Activity Inside App */}
                <div>
                    <h3 className="text-sm font-bold mb-4">Activity Inside App</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Card><CardContent className="p-6">
                            <div className="text-xs text-muted-foreground mb-2">Transactions</div>
                            <div className="text-3xl font-bold text-green-500 mb-1">2,456</div>
                        </CardContent></Card>
                        <Card><CardContent className="p-6">
                            <div className="text-xs text-muted-foreground mb-2">Features Used</div>
                            <div className="text-3xl font-bold text-slate-700 mb-1">12</div>
                        </CardContent></Card>
                        <Card><CardContent className="p-6">
                            <div className="text-xs text-muted-foreground mb-2">Avg Session</div>
                            <div className="text-3xl font-bold text-green-500 mb-1">45m</div>
                        </CardContent></Card>
                        <Card><CardContent className="p-6">
                            <div className="text-xs text-muted-foreground mb-2">Success Rate</div>
                            <div className="text-3xl font-bold text-orange-400 mb-1">91.5%</div>
                        </CardContent></Card>
                    </div>
                </div>

                {/* Activity Outside App */}
                <div>
                    <h3 className="text-sm font-bold mb-4">Activity Outside App</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Card><CardContent className="p-6">
                            <div className="text-xs text-muted-foreground mb-2">Transactions</div>
                            <div className="text-3xl font-bold text-slate-500 mb-1">8,234</div>
                        </CardContent></Card>
                        <Card><CardContent className="p-6">
                            <div className="text-xs text-muted-foreground mb-2">App Used</div>
                            <div className="text-3xl font-bold text-slate-700 mb-1">4.2</div>
                        </CardContent></Card>
                        <Card><CardContent className="p-6">
                            <div className="text-xs text-muted-foreground mb-2">Aug Session</div>
                            <div className="text-3xl font-bold text-orange-400 mb-1">$234K</div>
                        </CardContent></Card>
                        <Card><CardContent className="p-6">
                            <div className="text-xs text-muted-foreground mb-2">Success Rate</div>
                            <div className="text-3xl font-bold text-green-500 mb-1">95.8%</div>
                        </CardContent></Card>
                    </div>
                </div>
            </div>

            {/* Reusing the table structure for "Recent Active Wallet" */}
            <div>
                <h3 className="text-sm font-bold mb-4">Recent Active Wallet</h3>
                {/* We can just import WalletTab content or duplicate the table for now for purity */}
                {/* Duplicating simple table logic to avoid circular deps or complex props if not needed */}
                <WalletTab />
            </div>
        </div>
    )
}
