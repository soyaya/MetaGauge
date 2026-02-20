"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle, FileText, CheckCircle2, Lightbulb } from "lucide-react"

export function InsightTab() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold mb-1">Analysis & Insights</h3>
                <p className="text-sm text-muted-foreground mb-6">AI-Powered recommendations to improve your productivity</p>
            </div>

            <div className="space-y-4">
                {/* Insight 1 */}
                <div className="bg-white rounded-xl border p-6 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="mt-1"><AlertCircle className="w-5 h-5 text-red-500" /></div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-slate-900">High Gas Fee</h4>
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">Critical</span>
                                <span className="text-xs text-green-600 font-medium ml-2">+52%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 max-w-xl">
                                Your Avg gas fee is ($12.40) 52% higher that your competitors optimize contract call to reduce costs
                            </p>
                            <Button variant="outline" className="h-7 text-xs bg-slate-100 border-none text-slate-700">Optimize Gas Usage</Button>
                        </div>
                    </div>
                </div>

                {/* Insight 2 */}
                <div className="bg-white rounded-xl border p-6 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="mt-1"><AlertCircle className="w-5 h-5 text-red-500" /></div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-slate-900">Failed Transaction Rate</h4>
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">Critical</span>
                                <span className="text-xs text-green-600 font-medium ml-2">+52%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 max-w-xl">
                                8.5% failed rate is above industry standard. review transaction validation and errors handling
                            </p>
                            <Button variant="outline" className="h-7 text-xs bg-slate-100 border-none text-slate-700">Review Errors Logs</Button>
                        </div>
                    </div>
                </div>

                {/* Insight 3 */}
                <div className="bg-white rounded-xl border p-6 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="mt-1"><CheckCircle2 className="w-5 h-5 text-orange-500" /></div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-slate-900">Wallet Activity Outside App</h4>
                                <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded">Warning</span>
                                <span className="text-xs text-green-600 font-medium ml-2">+52%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 max-w-xl">
                                Active wallet are spending $2,345 elsewhere Vs $345 in your app. Focus on features engagement
                            </p>
                            <Button variant="outline" className="h-7 text-xs bg-slate-100 border-none text-slate-700">View Activity Report</Button>
                        </div>
                    </div>
                </div>

                {/* Insight 4 */}
                <div className="bg-white rounded-xl border p-6 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="mt-1"><Lightbulb className="w-5 h-5 text-blue-500" /></div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-slate-900">Improve Features Adoption</h4>
                                <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded">Suggestion</span>
                                <span className="text-xs text-green-600 font-medium ml-2">+52%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 max-w-xl">
                                App A has 50% higher features usage. Consider Implementing same workflows and user onboarding
                            </p>
                            <Button variant="outline" className="h-7 text-xs bg-slate-100 border-none text-slate-700">View Feature Analysis</Button>
                        </div>
                    </div>
                </div>

                {/* Insight 5 */}
                <div className="bg-white rounded-xl border p-6 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="mt-1"><Lightbulb className="w-5 h-5 text-blue-500" /></div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-slate-900">Bridge Optimization</h4>
                                <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded">Suggestion</span>
                                <span className="text-xs text-green-600 font-medium ml-2">+52%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 max-w-xl">
                                Track 234 wallet bridging out after using your app. Improve retention with better incentives
                            </p>
                            <Button variant="outline" className="h-7 text-xs bg-slate-100 border-none text-slate-700">View Bridge Data</Button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
