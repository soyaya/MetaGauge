"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, ArrowLeft } from "lucide-react"

export function BridgesTab() {
    return (
        <div className="space-y-8">

            {/* Funds Coming In */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-full text-green-600"><ArrowRight className="w-4 h-4" /></div>
                    <div>
                        <h3 className="font-bold">Funds Coming In</h3>
                        <p className="text-xs text-muted-foreground">Tracking bridged funds entering my chain</p>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-1">Total Volume</div>
                        <div className="flex items-end gap-2 text-green-500">
                            <span className="text-2xl font-bold">$1.2M</span>
                            <span className="text-[10px] mb-1">↗ 15.5%</span>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-1">Total Volume</div>
                        <div className="flex items-end gap-2 text-green-500">
                            <span className="text-2xl font-bold">94.2%</span>
                            <span className="text-[10px] mb-1">↗ 3.2%</span>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-1">Failed Tx</div>
                        <div className="flex items-end gap-2 text-orange-500">
                            <span className="text-2xl font-bold">18</span>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-1">Avg Gas</div>
                        <div className="flex items-end gap-2 text-green-500">
                            <span className="text-2xl font-bold">$8.40</span>
                            <span className="text-[10px] mb-1">↗ 5.5%</span>
                        </div>
                    </CardContent></Card>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-2">Time to First Tx</div>
                        <div className="text-2xl font-bold">4.2m</div>
                    </CardContent></Card>
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-2">Avg Inflow</div>
                        <div className="text-2xl font-bold text-green-500">$3,240</div>
                    </CardContent></Card>
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-2">Features Used</div>
                        <div className="text-2xl font-bold text-slate-600">8.4</div>
                    </CardContent></Card>
                </div>
            </div>

            {/* Funds Leaving */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-full text-green-600"><ArrowLeft className="w-4 h-4" /></div>
                    <div>
                        <h3 className="font-bold">Funds Leaving</h3>
                        <p className="text-xs text-muted-foreground">Tracking bridged funds existing my chain</p>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-1">Total Volume</div>
                        <div className="flex items-end gap-2 text-orange-500">
                            <span className="text-2xl font-bold">$890k</span>
                            <span className="text-[10px] mb-1">↗ 15.5%</span>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-1">Total Volume</div>
                        <div className="flex items-end gap-2 text-green-500">
                            <span className="text-2xl font-bold">96.8%</span>
                            <span className="text-[10px] mb-1">↗ 1.5%</span>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-1">Failed Tx</div>
                        <div className="flex items-end gap-2 text-green-500">
                            <span className="text-2xl font-bold">12</span>
                        </div>
                    </CardContent></Card>
                    <Card><CardContent className="p-6">
                        <div className="text-xs text-muted-foreground mb-1">Avg Gas</div>
                        <div className="flex items-end gap-2 text-green-500">
                            <span className="text-2xl font-bold">$7.20</span>
                            <span className="text-[10px] mb-1">↗ 5.5%</span>
                        </div>
                    </CardContent></Card>
                </div>

                <div className="border border-orange-200 bg-orange-50 rounded-lg p-6 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-orange-800 font-medium">Active wallet</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">234</div>
                        <div className="text-xs text-muted-foreground">High exist rate after app usage consider rentention strategies</div>
                    </div>
                    <div className="border border-orange-400 text-orange-600 text-xs px-3 py-1 rounded-full uppercase">Need Attention</div>
                </div>
            </div>

        </div>
    )
}
