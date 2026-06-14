'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Twitter, BarChart2, Copy, Check, Download, Share2, ExternalLink } from 'lucide-react';
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
    badgeColor: 'default' as const,
  },
  {
    id: 'twitter_thread',
    label: 'Twitter Thread',
    description: '5-7 tweet thread about your milestones using real on-chain numbers.',
    icon: Twitter,
    badge: 'Marketing',
    badgeColor: 'secondary' as const,
  },
  {
    id: 'pitch_slide',
    label: 'Pitch Slide Data',
    description: 'Headline, bullet points, and chart data structured for your pitch deck.',
    icon: BarChart2,
    badge: 'Pitch Deck',
    badgeColor: 'secondary' as const,
  },
];

export function ExportTab({ contractAddress, chain }: ExportTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);

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

  const copy = async (type: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const download = (type: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metagauge-${type}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createShare = async () => {
    setSharingLoading(true);
    try {
      const result = await (api as any).agent.createShareToken();
      setShareUrl(result.shareUrl);
      await navigator.clipboard.writeText(result.shareUrl);
      toast({ title: 'Share link copied!', description: `Expires ${new Date(result.expiresAt).toLocaleDateString()}` });
    } catch {
      toast({ title: 'Failed to create share link', variant: 'destructive' });
    } finally {
      setSharingLoading(false);
    }
  };

  const renderContent = (type: string, result: any) => {
    if (!result) return null;
    const content = result.content || '';

    if (type === 'twitter_thread') {
      // Try to parse as JSON array of tweets
      let tweets: string[] = [];
      try {
        const match = content.match(/\[[\s\S]*\]/);
        tweets = match ? JSON.parse(match[0]) : content.split('\n\n').filter(Boolean);
      } catch {
        tweets = content.split('\n\n').filter(Boolean);
      }
      return (
        <div className="space-y-3 mt-4">
          {tweets.map((tweet: string, i: number) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg border bg-muted/30">
              <span className="text-xs text-muted-foreground w-5 shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-sm leading-relaxed">{tweet.replace(/^"\s*|\s*"$/g, '')}</p>
            </div>
          ))}
        </div>
      );
    }

    if (type === 'pitch_slide') {
      let slide: any = null;
      try {
        const match = content.match(/\{[\s\S]*\}/);
        slide = match ? JSON.parse(match[0]) : null;
      } catch {}

      if (slide) {
        return (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border p-4 bg-primary/5">
              <p className="font-bold text-lg">{slide.headline}</p>
            </div>
            {slide.bullets?.length > 0 && (
              <ul className="space-y-1">
                {slide.bullets.map((b: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5">→</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
            {slide.chart_data?.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {slide.chart_data.map((d: any, i: number) => (
                  <div key={i} className="rounded border p-2 text-center">
                    <div className="text-lg font-bold">{d.value}</div>
                    <div className="text-xs text-muted-foreground">{d.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
    }

    // Default: plain text
    return (
      <div className="mt-4 p-4 rounded-lg border bg-muted/30 text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    );
  };

  return (
    <div className="space-y-4 pt-4">
      <div>
        <h3 className="font-semibold">Export & Share</h3>
        <p className="text-xs text-muted-foreground mt-1">Generate investor materials, marketing content, and pitch data from your real on-chain metrics.</p>
      </div>

      {/* Share link card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Share2 className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Public Intelligence Report</span>
                <Badge className="text-xs">New</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Share a verified link showing your growth scores — no login required for viewers. Valid 7 days.</p>
              {shareUrl && (
                <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary mt-2 underline">
                  {shareUrl} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Button size="sm" onClick={createShare} disabled={sharingLoading} className="shrink-0">
              {sharingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5 mr-1" />}
              {shareUrl ? 'New Link' : 'Create Link'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {TYPES.map(({ id, label, description, icon: Icon, badge, badgeColor }) => (
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
                    <Badge variant={badgeColor} className="text-xs">{badge}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
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
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Generating</>
                  : results[id] ? 'Regenerate' : 'Generate'}
              </Button>
            </div>
          </CardHeader>

          {results[id] && (
            <CardContent className="pt-0">
              {renderContent(id, results[id])}
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="ghost" onClick={() => copy(id, results[id].content)}>
                  {copied === id ? <Check className="h-3.5 w-3.5 mr-1 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied === id ? 'Copied' : 'Copy'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => download(id, results[id].content)}>
                  <Download className="h-3.5 w-3.5 mr-1" />Download
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
