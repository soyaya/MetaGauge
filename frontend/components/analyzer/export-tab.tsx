'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, FileText, Twitter, BarChart2, Copy, Check,
  Download, Share2, ExternalLink, AlertCircle, TrendingUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExportTabProps {
  contractAddress: string;
  chain: string;
}

// ── Inline markdown bold renderer ────────────────────────────────────────────
function Md({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>{parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i} className="text-foreground">{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>
    )}</>
  );
}

// ── Investor Summary — structured sections ────────────────────────────────────
function InvestorSummary({ content }: { content: string }) {
  // Split on **ALL CAPS HEADER** patterns
  const sections = content.split(/(?=\*\*[A-Z][A-Z\s&/]+\*\*)/).filter(s => s.trim());

  const SECTION_COLORS: Record<string, string> = {
    'CONTRACT OVERVIEW': 'border-blue-500/40 bg-blue-500/5',
    'TRACTION SNAPSHOT': 'border-green-500/40 bg-green-500/5',
    'BENCHMARK COMPARISON': 'border-purple-500/40 bg-purple-500/5',
    'GROWTH NARRATIVE': 'border-primary/30 bg-primary/5',
    'RISK FACTORS': 'border-red-500/40 bg-red-500/5',
    'OPPORTUNITIES': 'border-amber-500/40 bg-amber-500/5',
    'VERDICT': 'border-foreground/20 bg-foreground/5',
  };

  if (sections.length <= 1) {
    // Fallback: paragraph render
    return (
      <div className="mt-4 space-y-1.5 text-sm leading-relaxed">
        {content.split('\n').filter(Boolean).map((line, i) => (
          <p key={i}><Md text={line} /></p>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 text-sm">
      {sections.map((section, i) => {
        const lines = section.trim().split('\n').filter(Boolean);
        const headerRaw = lines[0].replace(/\*\*/g, '').trim();
        const body = lines.slice(1);
        const colorClass = SECTION_COLORS[headerRaw] || 'border-border bg-muted/20';
        return (
          <div key={i} className={`rounded-lg border p-3 ${colorClass}`}>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {headerRaw}
            </p>
            <div className="space-y-1 leading-relaxed">
              {body.map((line, j) => (
                <p key={j} className={line.startsWith('•') ? 'pl-2' : ''}>
                  <Md text={line} />
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Twitter Thread ────────────────────────────────────────────────────────────
function TwitterThread({ content }: { content: string }) {
  let tweets: string[] = [];
  try {
    const match = content.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : null;
    tweets = Array.isArray(parsed) ? parsed.map((t: any) => String(t).trim().replace(/^"|"$/g, '')) : [];
  } catch { /* fall through */ }

  if (!tweets.length) {
    tweets = content.split('\n').filter(l => l.trim().length > 15 && !l.startsWith('[') && !l.startsWith(']'));
  }

  return (
    <div className="mt-4 space-y-2">
      {tweets.map((tweet, i) => {
        const chars = tweet.length;
        const over = chars > 280;
        const warn = chars > 250 && !over;
        return (
          <div key={i} className={`rounded-xl border p-3 ${over ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/20'}`}>
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{i + 1}</span>
              </div>
              <p className="text-sm leading-relaxed flex-1 pt-0.5">{tweet}</p>
            </div>
            <div className={`text-right text-xs mt-1.5 ${over ? 'text-destructive font-medium' : warn ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {chars}/280{over ? ' ✗ too long' : warn ? ' ⚠ near limit' : ''}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground text-center pt-1">
        Copy individual tweets or use "Copy All" to post your thread.
      </p>
    </div>
  );
}

// ── Pitch Slide ───────────────────────────────────────────────────────────────
function PitchSlide({ content }: { content: string }) {
  let slide: any = null;
  try {
    // Strip markdown code fences if present
    const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    const match = cleaned.match(/\{[\s\S]*\}/);
    slide = match ? JSON.parse(match[0]) : null;
  } catch { /* fall through */ }

  if (!slide) {
    return (
      <div className="mt-4 p-3 rounded-lg border bg-muted/20 text-sm whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 text-sm">
      {/* Slide preview — mimics a pitch deck slide */}
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5">
        <div className="text-center space-y-2 mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Traction</p>
          <h2 className="font-bold text-lg text-foreground leading-tight">{slide.headline}</h2>
          {slide.subheadline && (
            <p className="text-sm text-muted-foreground">{slide.subheadline}</p>
          )}
          {slide.highlight && (
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-sm">
              {slide.highlight}
            </span>
          )}
        </div>

        <Separator className="my-3 bg-primary/20" />

        {/* Metric grid */}
        {slide.chart_data?.length > 0 && (
          <div className="grid grid-cols-5 gap-2 my-3">
            {slide.chart_data.map((d: any, i: number) => (
              <div key={i} className="rounded-lg border border-primary/20 bg-background/60 p-2 text-center">
                <div className="text-base font-bold text-foreground">{d.value}</div>
                <div className="text-xs text-muted-foreground leading-tight mt-0.5">{d.label}</div>
                {d.benchmark && (
                  <div className="text-xs text-primary/70 mt-0.5">vs {d.benchmark}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bullets — as they'd appear on the slide */}
      {slide.bullets?.length > 0 && (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Slide Bullet Points</p>
          {slide.bullets.map((b: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <TrendingUp className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <span>{b.replace(/^[•\-]\s*/, '')}</span>
            </div>
          ))}
        </div>
      )}

      {slide.footnote && (
        <p className="text-xs text-center text-muted-foreground">{slide.footnote}</p>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderContent(type: string, result: any) {
  const content = result?.content || '';
  if (type === 'investor_summary') return <InvestorSummary content={content} />;
  if (type === 'twitter_thread')   return <TwitterThread content={content} />;
  if (type === 'pitch_slide')      return <PitchSlide content={content} />;
  return <div className="mt-4 p-3 rounded-lg border bg-muted/20 text-sm whitespace-pre-wrap">{content}</div>;
}

function getPlainText(type: string, result: any): string {
  const content = result?.content || '';
  if (type !== 'twitter_thread') return content;
  try {
    const match = content.match(/\[[\s\S]*\]/);
    const tweets: string[] = match ? JSON.parse(match[0]) : [];
    return tweets.map((t, i) => `${i + 1}. ${t}`).join('\n\n');
  } catch { return content; }
}

const TYPES = [
  {
    id: 'investor_summary',
    label: 'Investor Summary',
    description: 'Data-room ready traction memo — metrics, benchmarks, risks, verdict.',
    icon: FileText,
    badge: 'Fundraising',
    audience: 'Seed/Series-A VCs · Angels · Crypto funds',
  },
  {
    id: 'twitter_thread',
    label: 'Twitter / X Thread',
    description: '6-7 tweet thread with exact on-chain numbers to announce milestones.',
    icon: Twitter,
    badge: 'Marketing',
    audience: 'Crypto Twitter · DeFi community · Developers',
  },
  {
    id: 'pitch_slide',
    label: 'Pitch Deck Slide',
    description: 'Structured headline, bullets, and metric grid for your Traction slide.',
    icon: BarChart2,
    badge: 'Pitch Deck',
    audience: 'Pitch meetings · Demo days · Data rooms',
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export function ExportTab({ contractAddress, chain }: ExportTabProps) {
  const { toast } = useToast();
  const [loading, setLoading]           = useState<string | null>(null);
  const [results, setResults]           = useState<Record<string, any>>({});
  const [copied, setCopied]             = useState<string | null>(null);
  const [shareUrl, setShareUrl]         = useState('');
  const [shareExpiry, setShareExpiry]   = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);
  const [pdfLoading, setPdfLoading]     = useState(false);

  const generate = async (type: string) => {
    setLoading(type);
    try {
      const result = await (api as any).agent.generateContent({ type, contractAddress, chain });
      setResults(prev => ({ ...prev, [type]: result }));
    } catch {
      toast({ title: 'Generation failed', description: 'Gemini API key may be missing or exhausted.', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const copy = async (type: string) => {
    await navigator.clipboard.writeText(getPlainText(type, results[type]));
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const downloadTxt = (type: string) => {
    const text = getPlainText(type, results[type]);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metagauge-${type}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${baseUrl}/api/traction/download-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metagauge-traction-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'PDF download failed', description: err.message, variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  };

  const createShare = async () => {
    setSharingLoading(true);
    try {
      const result = await (api as any).agent.createShareToken();
      setShareUrl(result.shareUrl);
      setShareExpiry(
        new Date(result.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      );
      await navigator.clipboard.writeText(result.shareUrl);
      toast({ title: 'Link copied!', description: `Valid until ${new Date(result.expiresAt).toLocaleDateString()}` });
    } catch {
      toast({ title: 'Failed to create share link', variant: 'destructive' });
    } finally {
      setSharingLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <div>
        <h3 className="font-semibold">Export &amp; Share</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI-generated content from your real on-chain metrics — ready for investors, marketing, and pitch decks.
        </p>
      </div>

      {/* ── PDF Download ── */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Full Traction PDF Report</span>
                <Badge className="text-xs">Investor Ready</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Complete report — OPS score, retention funnel, activation metrics, gas analysis, top wallets, and open tasks. Formatted for data rooms.
              </p>
            </div>
            <Button size="sm" onClick={downloadPDF} disabled={pdfLoading} className="shrink-0">
              {pdfLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Generating…</>
                : <><Download className="h-3.5 w-3.5 mr-1" />Download PDF</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Share Link ── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Share2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Public Intelligence Report</span>
                <Badge variant="secondary" className="text-xs">7-day link</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Shareable link showing your growth scores — no login required for viewers.
              </p>
              {shareUrl && (
                <div className="mt-2 space-y-0.5">
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary underline break-all">
                    {shareUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <p className="text-xs text-muted-foreground">Expires: {shareExpiry}</p>
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={createShare} disabled={sharingLoading} className="shrink-0">
              {sharingLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Share2 className="h-3.5 w-3.5 mr-1" />{shareUrl ? 'New Link' : 'Create Link'}</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── AI Content Cards ── */}
      {TYPES.map(({ id, label, description, icon: Icon, badge, audience }) => (
        <Card key={id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm">{label}</CardTitle>
                    <Badge variant="secondary" className="text-xs">{badge}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Audience: {audience}</p>
                  {results[id]?.hasRealData === false && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-600">
                      <AlertCircle className="h-3 w-3" />
                      <span>No indexed data yet — content will use placeholder values.</span>
                    </div>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={results[id] ? 'outline' : 'default'}
                onClick={() => generate(id)}
                disabled={loading === id}
                className="shrink-0"
              >
                {loading === id
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Generating…</>
                  : results[id] ? 'Regenerate' : 'Generate'}
              </Button>
            </div>
          </CardHeader>

          {results[id] && (
            <CardContent className="pt-0">
              <Separator className="mb-0" />
              {renderContent(id, results[id])}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button size="sm" variant="ghost" onClick={() => copy(id)}>
                  {copied === id
                    ? <><Check className="h-3.5 w-3.5 mr-1 text-green-500" />Copied</>
                    : <><Copy className="h-3.5 w-3.5 mr-1" />Copy All</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => downloadTxt(id)}>
                  <Download className="h-3.5 w-3.5 mr-1" />Download .txt
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  Generated {new Date(results[id].generatedAt).toLocaleString()}
                </span>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
