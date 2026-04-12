'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Header } from '@/components/ui/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Copy, RefreshCw, Key, Zap, Shield, Code2, Terminal } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function DevelopersPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [balance, setBalance] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/developers');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.users.getProfile().then((p: any) => { if (p.apiKey) setApiKey(p.apiKey); }).catch(() => {});
    api.get('/api/billing/usage').then((u: any) => setBalance(u.balance || 0)).catch(() => {});
  }, [isAuthenticated]);

  const generateKey = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/api/users/api-key', {});
      setApiKey(res.apiKey);
      setRevealed(true);
      toast({ title: 'New API key generated' });
    } catch {
      toast({ title: 'Failed to generate key', variant: 'destructive' });
    } finally { setGenerating(false); }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const maskedKey = apiKey ? apiKey.slice(0, 12) + '•'.repeat(20) + apiKey.slice(-4) : '';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16 space-y-6">

        <div>
          <h1 className="text-2xl font-bold">Developer API</h1>
          <p className="text-muted-foreground mt-1">Access MetaGauge data from your own apps and SDKs using your API key.</p>
        </div>

        {/* Key card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="w-4 h-4" /> Your API Key</CardTitle>
            <CardDescription>Pass as <code className="bg-muted px-1 rounded text-xs">X-API-Key</code> header. Requires positive balance — no free quota on API access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-muted rounded px-3 py-2 truncate">
                {apiKey ? (revealed ? apiKey : maskedKey) : 'No key yet'}
              </div>
              {apiKey && <>
                <Button size="sm" variant="outline" onClick={() => setRevealed(v => !v)}>{revealed ? 'Hide' : 'Reveal'}</Button>
                <Button size="sm" variant="outline" onClick={() => copy(apiKey, 'API key')}><Copy className="w-3 h-3" /></Button>
              </>}
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={generateKey} disabled={generating} size="sm">
                <RefreshCw className={`w-3 h-3 mr-2 ${generating ? 'animate-spin' : ''}`} />
                {apiKey ? 'Regenerate' : 'Generate Key'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Balance: <strong>${balance.toFixed(2)}</strong>
                {balance <= 0 && <span className="text-red-500 ml-1">— <a href="/subscription" className="underline">top up</a> to use API</span>}
              </span>
            </div>
            {apiKey && <p className="text-xs text-amber-600">Keep this secret. Regenerating invalidates the old key immediately.</p>}
          </CardContent>
        </Card>

        {/* Rate limits + pricing side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Zap className="w-4 h-4" /> Rate Limits</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="bg-muted rounded p-3"><p className="font-medium">60 requests / minute</p></div>
              <div className="bg-muted rounded p-3"><p className="font-medium">1,000 requests / day</p></div>
              <p className="text-xs text-muted-foreground">Headers: <code className="bg-muted px-1 rounded">X-RateLimit-Remaining-Minute</code> <code className="bg-muted px-1 rounded">X-RateLimit-Reset</code></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="w-4 h-4" /> Pricing</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  {[['Read data (contracts, results)', 'Free'],['Start analysis', '$0.10'],['AI chat message', '$0.05']].map(([a, c]) => (
                    <tr key={a} className="border-b last:border-0">
                      <td className="py-1.5 text-muted-foreground text-xs">{a}</td>
                      <td className="py-1.5 text-right font-medium text-xs">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Code examples */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Terminal className="w-4 h-4" /> Quick Start</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { lang: 'cURL', code: `curl ${BASE_URL}/api/contracts \\\n  -H "X-API-Key: ${apiKey || 'mg_live_your_key'}"` },
              { lang: 'JavaScript', code: `const res = await fetch('${BASE_URL}/api/contracts', {\n  headers: { 'X-API-Key': '${apiKey || 'mg_live_your_key'}' }\n});\nconst { contracts } = await res.json();` },
              { lang: 'Python', code: `import requests\nres = requests.get('${BASE_URL}/api/contracts',\n  headers={'X-API-Key': '${apiKey || 'mg_live_your_key'}'}\n)\ncontracts = res.json()['contracts']` },
            ].map(({ lang, code }) => (
              <div key={lang}>
                <p className="text-xs text-muted-foreground mb-1">{lang}</p>
                <div className="relative">
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{code}</pre>
                  <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6"
                    onClick={() => copy(code, lang)}><Copy className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="w-4 h-4" /> Endpoints</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {[
                ['GET',  '/api/contracts',                  'List contracts'],
                ['POST', '/api/contracts',                  'Add contract'],
                ['GET',  '/api/contracts/:id',              'Contract details'],
                ['GET',  '/api/analysis/:id/results',       'Analysis results'],
                ['POST', '/api/analysis/start',             'Start analysis ($0.10)'],
                ['GET',  '/api/traction/dashboard',         'Traction dashboard'],
                ['GET',  '/api/subscription/status',        'Balance & quota'],
                ['POST', '/api/chat/sessions',              'Create chat session'],
                ['POST', '/api/chat/sessions/:id/messages', 'AI message ($0.05)'],
              ].map(([method, path, desc]) => (
                <div key={`${method}-${path}`} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                  <Badge variant={method === 'GET' ? 'secondary' : 'default'} className="w-12 justify-center text-xs shrink-0">{method}</Badge>
                  <code className="flex-1 text-xs truncate">{path}</code>
                  <span className="text-muted-foreground text-xs hidden sm:block shrink-0">{desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
