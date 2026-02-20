"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export function WalletTab() {
    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-bold mb-4">Active Wallet</h3>
                <div className="rounded-xl border bg-card overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/5">
                            <TableRow>
                                <TableHead className="w-[150px] text-xs">Wallet</TableHead>
                                <TableHead className="text-xs">Features</TableHead>
                                <TableHead className="text-xs">Time</TableHead>
                                <TableHead className="text-xs">Gas Paid</TableHead>
                                <TableHead className="text-xs">Inflow</TableHead>
                                <TableHead className="text-xs">Outflow</TableHead>
                                <TableHead className="text-xs">Revenue</TableHead>
                                <TableHead className="text-xs">Success Tx</TableHead>
                                <TableHead className="text-xs">Failure Tx</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[
                                { w: "0x742d...a4f2", f: 12, t: "45m", g: "$12.40", i: "$2,490", o: "$890", r: "$1,450", s: 48, fl: 4 },
                                { w: "0x3e8c...b1d9", f: 8, t: "32m", g: "$8.90", i: "$2,200", o: "$450", r: "$750", s: 462, fl: 3 },
                                { w: "0x9a1f...c7e4", f: 15, t: "68m", g: "$18.90", i: "$5,600", o: "$2,100", r: "$3,500", s: 89, fl: 12 },
                                { w: "0xa84e...f8e6", f: 5, t: "22m", g: "$45.60", i: "$1,600", o: "$850", r: "$300", s: 152, fl: 6 },
                            ].map((row, i) => (
                                <TableRow key={i}>
                                    <TableCell className="text-xs text-muted-foreground">{row.w}</TableCell>
                                    <TableCell className="text-xs text-foreground">{row.f}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{row.t}</TableCell>
                                    <TableCell className="text-xs font-medium">{row.g}</TableCell>
                                    <TableCell className="text-xs text-green-500">{row.i}</TableCell>
                                    <TableCell className="text-xs text-orange-500">{row.o}</TableCell>
                                    <TableCell className="text-xs text-foreground">{row.r}</TableCell>
                                    <TableCell className="text-xs text-green-500">{row.s}</TableCell>
                                    <TableCell className="text-xs text-red-500">{row.fl}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                <Card><CardContent className="p-6">
                    <div className="text-xs text-muted-foreground mb-1">Wallet Going Out</div>
                    <div className="flex items-end gap-2 mb-1">
                        <div className="text-3xl font-bold text-orange-500">1,247</div>
                        <div className="text-[10px] text-orange-400 mb-1">↗ 18.2%</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">tracking activity elsewhere</div>
                </CardContent></Card>

                <Card><CardContent className="p-6">
                    <div className="text-xs text-muted-foreground mb-1">New Wallets Coming In</div>
                    <div className="flex items-end gap-2 mb-1">
                        <div className="text-3xl font-bold text-green-500">189</div>
                        <div className="text-[10px] text-green-400 mb-1">↗ 12.4%</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">from other apps</div>
                </CardContent></Card>

                <Card><CardContent className="p-6">
                    <div className="text-xs text-muted-foreground mb-1">Dormant Wallets</div>
                    <div className="flex items-end gap-2 mb-1">
                        <div className="text-3xl font-bold text-orange-500">456</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">No activity this month</div>
                </CardContent></Card>
            </div>
        </div>
    )
}
