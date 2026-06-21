'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, FileText, Twitter, BarChart2, Copy, Check,
  Download, Share2, ExternalLink, AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExportTabProps {
  contractAddress: string;
  chain: string;
}

const TYPES = [
  {
    id: 'investor_summary',
    label: 'Investor Summary',
    description: 'One-page traction overview with benchmarks — ready for investor emails and data rooms.',
    icon: FileText,
    badge: 'Fundraising',
  },
  {
    id: 'twitter_thread',
    label: 'Twitter / X Thread',
    description: '5-7 tweet thread about your milestones using real on-chain numbers.',
    icon: Twitter,
    badge: 'Marketing',
  },
  {
    id: 'pitch_slide',
    label: 'Pitch Slide Data',
    description: 'Headline, bullets, and chart data structured for your pitch deck.',
    icon: BarChart2,
    badge: 'Pitch Deck',
  },
];

/** Render bold markdown (**text**) as <strong> */
function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function InvestorSummary({ content }: { content: string }) {
  // Split on section headers (**HEADER**)
  const sections = content.split(/(?=\*\*[A-Z][A-Z\s&]+\*\*)/g).filter(Boolean);
  if (sections.length <= 1) {
    // Fallback: render as plain paragraphs
    return (
      <div className="mt-4 space-y-2 text-sm leading-relaxed">
        {content.split('\n').filter(Boolean).map((line, i) => (
          <p key={i}><MarkdownText text={line} /></p>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-4 text-sm">
      {sections.map((section, i) => {
        const lines = section.trim().split('\n').filter(Boolean);
        const header = lines[0];
        const body = lines.slice(1);
        return (
          <div key={i} className="rounded-lg border bg-muted/20 p-3">
            <p className="font-semibold text-foreground mb-1">
              <MarkdownText text={header} />
            </p>
            <div className="space-y-1 text-muted-foreground leading-relaxed">
              {body.map((line, j) => (
                <p key={j}><MarkdownText text={line} /></p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TwitterThread({ content }: { content: string }) {
  let tweets: string[] = [];
  try {
    const match = content.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : null;
    tweets = Array.isArray(parsed) ? parsed.map(t => String(t).replace(/^"|"$/g, '').trim()) : [];
  } catch { /* fall through */ }

  if (!tweets.length) {
    // Try line-based fallback
    tweets = content.split('\n').filter(l => l.trim().length > 10);
  }

  return (
    <div className="mt-4 space-y-2">
      {tweets.map((tweet, i) => {
        const chars = tweet.length;
        const over = chars > 280;
        return (
          <div key={i} className="rounded-lg border p-3 bg-muted/20">
            <div className="flex gap-2">
              <span className="text-xs font-bold text-primary w-5 shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-sm leading-relaxed flex-1">{tweet}</p>
            </div>
            <div className={`text-right text-xs mt-1 ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
              {chars}/280{over && ' — too long'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PitchSlide({ content }: { content: string }) {
  let slide: any = null;
  try {
    const match = content.match(/\{[\s\S]*\}/);
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
      {/* Headline box */}
      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 text-center">
        <p className="font-bold text-base text-foreground">{slide.headline}</p>
        {slide.subheadline && (
          <p className="text-muted-foreground mt-1">{slide.subheadline}</p>
        )}
        {slide.highlight && (
          <span className="inline-block mt-2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {slide.highlight}
          </span>
        )}
      </div>

      {/* Bullets */}
      {slide.bullets?.length > 0 && (
        <div className="rounded-lg border p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Metrics</p>
          {slide.bullets.map((b: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-primary mt-0.5 shrink-0">→</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart data grid */}
      {slide.chart_data?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Chart Data</p>
          <div className="grid grid-cols-3 gap-2">
            {slide.chart_data.map((d: any, i: number) => (
              <div key={i} className="rounded border p-2 text-center bg-muted/20">
                <div className="text-lg font-bold text-foreground">{d.value}</div>
                <div className="text-xs text-muted-foreground">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footnote */}
      {slide.footnote && (
        <p className="text-xs text-muted-foreground text-center">{slide.footnote}</p>
      )}
    </div>
  );
}

function renderContent(type: string, result: any) {
  const content = result?.content || '';
  if (type === 'investor_summary') return <InvestorSummary content={content} />;
  if (type === 'twitter_thread')  return <TwitterThread content={content} />;
  if (type === 'pitch_slide')     return <PitchSlide content={content} />;
  return <div className="mt-4 p-3 rounded-lg border bg-muted/20 text-sm whitespace-pre-wrap">{content}</div>;
}

function getDownloadText(type: string, result: any): string {
  if (type !== 'twitter_thread') return result.content || '';
  try {
    const match = result.content.match(/\[[\s\S]*\]/);
    const tweets: string[] = match ? JSON.parse(match[0]) : [];
    return tweets.map((t, i) => `Tweet ${i + 1}:\n${t}`).join('\n\n');
  } catch { return result.content || ''; }
}

export function ExportTab({ contractAddress, chain }: ExportTabProps) {
  const { toast } = useToast();
  const [loading, setLoading]       = useState<string | null>(null);
  const [results, setResults]       = useState<Record<string, any>>({});
  const [copied, setCopied]         = useState<string | null>(null);
  const [shareUrl, setShareUrl]     = useState('');
  const [shareExpiry, setShareExpiry] = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const generate = async (type: string) => {
    setLoading(type);
    try {
      const result = await (api as any).agent.generateContent({ type, contractAddress, chain });
      setResults(prev => ({ ...prev, [type]: result }));
    } catch {
      toast({ title: 'Generation failed', description: 'Check your Gemini API key is configured.', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const copy = async (type: string) => {
    const text = getDownloadText(type, results[type]);
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const download = (type: string) => {
    const text = getDownloadText(type, results[type]);
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
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metagauge-traction-report-${new Date().toISOString().slice(0, 10)}.pdf`;
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
      setShareExpiry(new Date(result.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
      await navigator.clipboard.writeText(result.shareUrl);
      toast({ title: 'Share link copied!', description: `Expires ${new Date(result.expiresAt).toLocaleDateString()}` });
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
        <p className="text-xs text-muted-foreground mt-1">
          Generate investor materials, marketing content, and pitch data from your real on-chain metrics.
        </p>
      </div>

      {/* PDF Report Download */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Full Traction PDF Report</span>
                <Badge className="text-xs">All Sections</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Download a complete investor-ready PDF — OPS score, retention, activation, gas, top wallets, and open tasks.
              </p>
            </div>
            <Button size="sm" onClick={downloadPDF} disabled={pdfLoading} className="shrink-0">
              {pdfLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Generating</>
                : <><Download className="h-3.5 w-3.5 mr-1" />Download PDF</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Share link card */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Share2 className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Public Intelligence Report</span>
                <Badge variant="secondary" className="text-xs">7-day link</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Share a verified link showing your growth scores — no login required for viewers.
              </p>
              {shareUrl && (
                <div className="mt-2 space-y-0.5">
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary underline">
                    {shareUrl} <ExternalLink className="h-3 w-3" />
                  </a>
                  {shareExpiry && (
                    <p className="text-xs text-muted-foreground">Expires: {shareExpiry}</p>
                  )}
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={createShare} disabled={sharingLoading} className="shrink-0">
              {sharingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5 mr-1" />}
              {shareUrl ? 'New Link' : 'Create Link'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI content generators */}
      {TYPES.map(({ id, label, description, icon: Icon, badge }) => (
        <Card key={id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{label}</CardTitle>
                    <Badge variant="secondary" className="text-xs">{badge}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  {results[id]?.hasRealData === false && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                      <AlertCircle className="h-3 w-3" />
                      <span>No indexed data — index a contract first for real numbers.</span>
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
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Generating&hellip;</>
                  : results[id] ? 'Regenerate' : 'Generate'}
              </Button>
            </div>
          </CardHeader>

          {results[id] && (
            <CardContent className="pt-0">
              {renderContent(id, results[id])}
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="ghost" onClick={() => copy(id)}>
                  {copied === id
                    ? <><Check className="h-3.5 w-3.5 mr-1 text-green-500" />Copied</>
                    : <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => download(id)}>
                  <Download className="h-3.5 w-3.5 mr-1" />Download .txt
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Generated {new Date(results[id].generatedAt).toLocaleString()}
              </p>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
