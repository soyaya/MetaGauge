'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader2, Search, TrendingUp, ExternalLink, Star, Zap } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface Project {
  contract_address: string
  chain: string
  display_name?: string
  contract_name?: string
  category?: string
  stage?: string
  match_score?: number
  matched_comps?: Array<{ name: string; score: number; notes: string }>
  retention_curve_shape?: { d1: number; d7: number; d30: number }
  cac_trend?: string
  revenue_acceleration?: number[]
  research_summary?: any
  income_statement?: any
  unit_economics?: any
  contact_email?: string
  contact_website?: string
  documents_public?: boolean
  investor_brief?: string
  featured_since?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 70) return 'text-green-700 bg-green-50 border-green-200'
  if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-gray-600 bg-gray-50 border-gray-200'
}

function scoreDot(score: number) {
  if (score >= 70) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-gray-400'
}

function chainBadgeColor(chain: string) {
  const map: Record<string, string> = {
    ethereum: 'bg-blue-100 text-blue-700',
    starknet: 'bg-purple-100 text-purple-700',
    lisk:     'bg-yellow-100 text-yellow-700',
    arbitrum: 'bg-cyan-100 text-cyan-700',
  }
  return map[chain?.toLowerCase()] || 'bg-gray-100 text-gray-600'
}

// ── Project Card ───────────────────────────────────────────────────────────

function ProjectCard({ project, onViewReport }: { project: Project; onViewReport: (p: Project) => void }) {
  const topComp = project.matched_comps?.[0]
  const ret = project.retention_curve_shape
  const lastRevGrowth = project.revenue_acceleration?.slice(-1)[0]
  const name = project.display_name || project.contract_name || project.contract_address?.slice(0, 10) + '...'

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">{name}</CardTitle>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${chainBadgeColor(project.chain)}`}>
                {project.chain}
              </span>
              {project.category && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {project.category}
                </span>
              )}
              {project.stage && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  {project.stage}
                </Badge>
              )}
            </div>
          </div>

          {/* Match Score */}
          {project.match_score != null && (
            <div className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2 min-w-[64px] ${scoreColor(project.match_score)}`}>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${scoreDot(project.match_score)}`} />
                <span className="text-xl font-bold leading-none">{project.match_score}</span>
              </div>
              <span className="text-[10px] mt-0.5 opacity-70">/100</span>
            </div>
          )}
        </div>

        {/* Top comp match */}
        {topComp && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 shrink-0" />
            <span>Matches early <span className="font-medium text-foreground">{topComp.name.split(' ')[0]}</span> pattern</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between gap-3 pt-0">
        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center bg-muted/30 rounded-lg py-1.5 px-1">
            <div className="text-xs font-semibold">{ret?.d7 != null ? `${ret.d7}%` : '—'}</div>
            <div className="text-[10px] text-muted-foreground">D7 Ret.</div>
          </div>
          <div className="text-center bg-muted/30 rounded-lg py-1.5 px-1">
            <div className="text-xs font-semibold">{ret?.d30 != null ? `${ret.d30}%` : '—'}</div>
            <div className="text-[10px] text-muted-foreground">D30 Ret.</div>
          </div>
          <div className={`text-center rounded-lg py-1.5 px-1 ${
            project.cac_trend === 'improving' ? 'bg-green-50' :
            project.cac_trend === 'degrading' ? 'bg-red-50' : 'bg-muted/30'
          }`}>
            <div className="text-xs font-semibold capitalize">{project.cac_trend || '—'}</div>
            <div className="text-[10px] text-muted-foreground">CAC</div>
          </div>
        </div>

        {/* Research data */}
        {project.research_summary && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {project.research_summary.tvl_usd > 0 && (
              <div>TVL: <span className="font-medium text-foreground">${Math.round(project.research_summary.tvl_usd).toLocaleString()}</span></div>
            )}
            {project.research_summary.price_usd && (
              <div>Token: <span className="font-medium text-foreground">${project.research_summary.price_usd}</span>
                {project.research_summary.price_change_7d != null && (
                  <span className={project.research_summary.price_change_7d >= 0 ? 'text-green-600 ml-1' : 'text-red-500 ml-1'}>
                    ({project.research_summary.price_change_7d > 0 ? '+' : ''}{project.research_summary.price_change_7d?.toFixed(1)}% 7d)
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI brief */}
        {project.investor_brief && (
          <div className="text-xs text-muted-foreground bg-blue-50/50 rounded-lg p-2 leading-relaxed border border-blue-100/60">
            {project.investor_brief.slice(0, 180)}{project.investor_brief.length > 180 ? '...' : ''}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-1">
          {project.documents_public && (
            <Button size="sm" variant="default" className="flex-1 text-xs h-8" onClick={() => onViewReport(project)}>
              <Star className="h-3 w-3 mr-1" /> View Report
            </Button>
          )}
          {project.contact_website && (
            <Button size="sm" variant="outline" className="text-xs h-8 flex-1"
              onClick={() => window.open(project.contact_website, '_blank')}>
              <ExternalLink className="h-3 w-3 mr-1" /> Contact
            </Button>
          )}
          {!project.documents_public && !project.contact_website && (
            <div className="text-xs text-muted-foreground text-center w-full py-1">
              Documents private
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Discover Tab ──────────────────────────────────────────────────────

export function FeaturedProjectsTab() {
  const [projects, setProjects] = useState<Project[]>([])
  const [recommendations, setRecommendations] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [chainFilter, setChainFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [minScore, setMinScore] = useState('0')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (chainFilter)    params.set('chain', chainFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      if (stageFilter)    params.set('stage', stageFilter)
      if (minScore)       params.set('minScore', minScore)

      const [proj, recs] = await Promise.all([
        api.get(`/api/registry/projects?${params}`),
        api.get(`/api/registry/recommendations?minScore=60`),
      ])
      setProjects((proj as any).projects || [])
      setRecommendations((recs as any).recommendations || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProjects() }, [chainFilter, categoryFilter, stageFilter, minScore])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res: any = await api.post('/api/registry/recommendations/search', { query: searchQuery })
      setProjects(res.results || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Discover
        </h2>
        <p className="text-sm text-muted-foreground">
          Early-stage projects with verified on-chain growth patterns matching successful protocols
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Find DeFi on Ethereum with Uniswap-like growth..."
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={chainFilter} onChange={e => setChainFilter(e.target.value)}
          className="text-xs border rounded-md px-2 py-1.5 bg-background">
          <option value="">All Chains</option>
          <option value="ethereum">Ethereum</option>
          <option value="starknet">Starknet</option>
          <option value="lisk">Lisk</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="text-xs border rounded-md px-2 py-1.5 bg-background">
          <option value="">All Categories</option>
          <option value="Dex">DEX</option>
          <option value="Lending">Lending</option>
          <option value="Derivatives">Derivatives</option>
          <option value="NFT">NFT</option>
          <option value="Yield">Yield</option>
        </select>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="text-xs border rounded-md px-2 py-1.5 bg-background">
          <option value="">All Stages</option>
          <option value="early">Early</option>
          <option value="growth">Growth</option>
          <option value="mature">Mature</option>
        </select>
        <select value={minScore} onChange={e => setMinScore(e.target.value)}
          className="text-xs border rounded-md px-2 py-1.5 bg-background">
          <option value="0">All Scores</option>
          <option value="50">Score 50+</option>
          <option value="70">Score 70+</option>
          <option value="80">Score 80+</option>
        </select>
        <Button variant="outline" size="sm" onClick={loadProjects}>Reset</Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
      )}

      {/* AI Recommendations section */}
      {recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            AI Recommendations — Top Growth Signals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.slice(0, 3).map((p, i) => (
              <ProjectCard key={i} project={p} onViewReport={setSelectedProject} />
            ))}
          </div>
        </div>
      )}

      {/* All featured projects */}
      <div>
        <h3 className="text-sm font-semibold mb-3">
          All Featured Projects
          {projects.length > 0 && <span className="font-normal text-muted-foreground ml-2">({projects.length})</span>}
        </h3>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Zap className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <h3 className="font-semibold mb-1">No Projects Featured Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Projects can opt in to be featured here from their dashboard settings.
                  Once featured, their growth patterns are matched against successful protocols.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p, i) => (
              <ProjectCard key={i} project={p} onViewReport={setSelectedProject} />
            ))}
          </div>
        )}
      </div>

      {/* Report modal for selected project */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedProject(null)}>
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {selectedProject.display_name || selectedProject.contract_name}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)}>✕</Button>
              </div>
              <CardDescription className="text-xs">
                {selectedProject.chain} · {selectedProject.category} · Match Score: {selectedProject.match_score}/100
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedProject.investor_brief && (
                <div className="bg-blue-50 rounded-lg p-4 text-sm leading-relaxed">
                  {selectedProject.investor_brief}
                </div>
              )}
              {selectedProject.income_statement && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial Snapshot</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/30 rounded p-2">
                      <div className="text-muted-foreground">Revenue</div>
                      <div className="font-semibold">${(selectedProject.income_statement?.revenue?.total_revenue || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-muted/30 rounded p-2">
                      <div className="text-muted-foreground">Gross Margin</div>
                      <div className="font-semibold">{selectedProject.income_statement?.gross_margin_pct || 0}%</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
