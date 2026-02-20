"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const benchmarkData = [
    { platform: "My App", adoption: "320", retention: "$720", failRate: "2.1%", returnUser: "39%", gas: "$4", fee: "3%", isMe: true },
    { platform: "Uniswap", adoption: "41k", retention: "$320", failRate: "0.3%", returnUser: "60%", gas: "$1", fee: "3%" },
    { platform: "Sushi", adoption: "3.2k", retention: "$140", failRate: "1.2%", returnUser: "48%", gas: "$1", fee: "3%" },
    { platform: "Curve", adoption: "6k", retention: "$600", failRate: "0.6%", returnUser: "53%", gas: "$2", fee: "2%" },
    { platform: "Velodrome", adoption: "900", retention: "$120", failRate: "3.4%", returnUser: "30%", gas: "$2", fee: "3%" },
    { platform: "Velodrome", adoption: "900", retention: "$120", failRate: "3.4%", returnUser: "30%", gas: "$2", fee: "3%" },
    { platform: "Velodrome", adoption: "900", retention: "$120", failRate: "3.4%", returnUser: "30%", gas: "$2", fee: "3%" },
    { platform: "Velodrome", adoption: "900", retention: "$120", failRate: "3.4%", returnUser: "30%", gas: "$2", fee: "3%" },
    { platform: "Velodrome", adoption: "900", retention: "$120", failRate: "3.4%", returnUser: "30%", gas: "$2", fee: "3%" },
]

export function BenchmarkTable() {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader className="bg-muted/5">
                    <TableRow>
                        <TableHead className="w-[150px] font-semibold text-xs text-muted-foreground uppercase">Platform</TableHead>
                        <TableHead className="font-semibold text-xs text-muted-foreground uppercase">Adoption</TableHead>
                        <TableHead className="font-semibold text-xs text-muted-foreground uppercase">Retention</TableHead>
                        <TableHead className="font-semibold text-xs text-muted-foreground uppercase">Fail Rate</TableHead>
                        <TableHead className="font-semibold text-xs text-muted-foreground uppercase">Return User</TableHead>
                        <TableHead className="font-semibold text-xs text-muted-foreground uppercase">Gas</TableHead>
                        <TableHead className="font-semibold text-xs text-muted-foreground uppercase">Fee</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {benchmarkData.map((item, index) => (
                        <TableRow key={index} className={item.isMe ? "bg-muted/20 hover:bg-muted/30" : ""}>
                            <TableCell className="font-medium text-sm text-muted-foreground">{item.platform}</TableCell>
                            <TableCell className="text-sm text-foreground">{item.adoption}</TableCell>
                            <TableCell className={`text-sm ${item.isMe ? "text-green-600 font-medium" : "text-foreground"}`}>{item.retention}</TableCell>
                            <TableCell className={`text-sm ${item.isMe ? "text-red-500" : "text-foreground"}`}>{item.failRate}</TableCell>
                            <TableCell className={`text-sm ${item.platform === "Uniswap" ? "text-green-600" : "text-muted-foreground"}`}>{item.returnUser}</TableCell>
                            <TableCell className={`text-sm ${item.isMe ? "text-red-500" : "text-foreground"}`}>{item.gas}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.fee}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
