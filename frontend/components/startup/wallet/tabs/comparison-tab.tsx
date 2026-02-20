"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export function ComparisonTab() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold mb-1">App Comparison</h3>
                <p className="text-sm text-muted-foreground mb-4">See how your app performs against competitors</p>

                <div className="rounded-xl border bg-card overflow-hidden">
                    <Table>
                        <TableHeader className="bg-white">
                            <TableRow>
                                <TableHead className="w-[200px]"></TableHead>
                                <TableHead className="text-center text-xs font-bold text-foreground">My App</TableHead>
                                <TableHead className="text-center text-xs font-medium">App A</TableHead>
                                <TableHead className="text-center text-xs font-medium">App B</TableHead>
                                <TableHead className="text-center text-xs font-medium">App C</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[
                                { metric: "Feature Used", my: 12, a: 18, b: 15, c: 20, bad: true },
                                { metric: "Avg time on platform", my: "45m", a: "32m", b: "38m", c: "28m", good: true },
                                { metric: "Failed Tx %", my: "8.5%", a: "4.2%", b: "5.8%", c: "3.9%", bad: true },
                                { metric: "Avg Gas Paid", my: "$12.40", a: "$8.20", b: "$9.50", c: "$7.80", bad: true },
                                { metric: "Success Rate", my: "91.5%", a: "95.8%", b: "94.2%", c: "96.1%", bad: true },
                            ].map((row, i) => (
                                <TableRow key={i} className="even:bg-muted/5">
                                    <TableCell className="text-xs text-muted-foreground font-medium">{row.metric}</TableCell>
                                    <TableCell className="text-center">
                                        <span className={`text-xs font-bold ${row.bad ? "text-red-500" : row.good ? "text-green-500" : ""}`}>
                                            {row.my} {row.bad ? "↘" : row.good ? "↗" : ""}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center text-xs text-muted-foreground">{row.a}</TableCell>
                                    <TableCell className="text-center text-xs text-muted-foreground">{row.b}</TableCell>
                                    <TableCell className="text-center text-xs text-muted-foreground">{row.c}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
