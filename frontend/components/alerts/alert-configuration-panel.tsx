'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Save, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface ThresholdConfig {
  enabled: boolean
  value: number
  unit: string
}

interface AlertConfig {
  id?: string
  contractId: string | null
  enabled: boolean
  categories: Record<string, boolean>
  severityLevels: Record<string, boolean>
  thresholds: Record<string, ThresholdConfig>
  notifications: {
    inApp: boolean
    email: boolean
    webhook: boolean
    webhookUrl: string | null
  }
  schedule: {
    realTime: boolean
    daily: boolean
    weekly: boolean
  }
}

export function AlertConfigurationPanel({ contractId = null }: { contractId?: string | null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [agentConfig, setAgentConfig] = useState<any>({
    enabled: false,
    permissions: { createTasks: false, autoAnalyze: false, sendDigests: false, postSocial: false, checkCompetitors: false, regressionAlerts: false },
  });

  useEffect(() => {
    loadConfig();
  }, [contractId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const [alertRes, agentRes] = await Promise.all([
        (api as any).alerts.getConfig(),
        api.get('/api/alerts/agent-config').catch(() => ({ config: null })),
      ]);
      const existingConfig = contractId
        ? alertRes.configs?.find((c: AlertConfig) => c.contractId === contractId)
        : alertRes.configs?.find((c: AlertConfig) => !c.contractId);
      setConfig(existingConfig || getDefaultConfig());
      if (agentRes.config) setAgentConfig(agentRes.config);
    } catch {
      setConfig(getDefaultConfig());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultConfig = () => ({
    contractId,
    enabled: true,
    categories: {
      security: true,
      performance: true,
      liquidity: true,
      anomaly: true,
      growth: true
    },
    severityLevels: {
      critical: true,
      high: true,
      medium: true,
      low: false
    },
    thresholds: {
      gasPrice: { enabled: false, value: 100, unit: 'gwei' },
      failureRate: { enabled: false, value: 5, unit: '%' },
      tvlChange: { enabled: false, value: 20, unit: '%' },
      volumeChange: { enabled: false, value: 30, unit: '%' },
      userDropoff: { enabled: false, value: 25, unit: '%' },
      whaleActivity: { enabled: false, value: 100000, unit: 'USD' }
    },
    notifications: {
      inApp: true,
      email: false,
      webhook: false,
      webhookUrl: null
    },
    schedule: {
      realTime: true,
      daily: false,
      weekly: false
    }
  });

  const saveConfig = async () => {
    if (!config) return;
    try {
      setSaving(true);
      setMessage('');
      // Save alert config first (need the id if newly created)
      if (config.id) {
        await (api as any).alerts.updateConfig(config.id, config);
      } else {
        const r = await (api as any).alerts.createConfig(config);
        setConfig(r.config);
      }
      // Save agent config in parallel is fine — independent
      await api.put('/api/alerts/agent-config', agentConfig);
      setMessage('Configuration saved successfully!');
      setIsError(false);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to save configuration');
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (category: string, value: boolean) => {
    setConfig(prev => prev ? ({ ...prev, categories: { ...prev.categories, [category]: value } }) : prev);
  };

  const updateSeverity = (level: string, value: boolean) => {
    setConfig(prev => prev ? ({ ...prev, severityLevels: { ...prev.severityLevels, [level]: value } }) : prev);
  };

  const updateThreshold = (key: string, field: string, value: boolean | number) => {
    setConfig(prev => prev ? ({
      ...prev,
      thresholds: { ...prev.thresholds, [key]: { ...prev.thresholds[key], [field]: value } }
    }) : prev);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!config) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alert Configuration
            </CardTitle>
            <CardDescription>
              Configure what alerts you want to receive and set custom thresholds
            </CardDescription>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(value) => setConfig(prev => prev ? ({ ...prev, enabled: value }) : prev)}
          />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="severity">Severity</TabsTrigger>
            <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="competitors">Competitors</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
          </TabsList>
          <TabsContent value="categories" className="space-y-4">
            <p className="text-sm text-muted-foreground">Select which types of alerts you want to receive</p>
            
            {Object.entries(config.categories).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b">
                <div>
                  <Label className="capitalize">{key}</Label>
                  <p className="text-xs text-muted-foreground">
                    {getCategoryDescription(key)}
                  </p>
                </div>
                <Switch
                  checked={value}
                  onCheckedChange={(val) => updateCategory(key, val)}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="severity" className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose which severity levels to monitor</p>
            
            {Object.entries(config.severityLevels).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Badge variant={getSeverityVariant(key)}>{key}</Badge>
                  <span className="text-sm">{getSeverityDescription(key)}</span>
                </div>
                <Switch
                  checked={value}
                  onCheckedChange={(val) => updateSeverity(key, val)}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="thresholds" className="space-y-4">
            <p className="text-sm text-muted-foreground">Set custom thresholds for alerts</p>
            
            {Object.entries(config.thresholds).map(([key, threshold]) => (
              <div key={key} className="space-y-2 py-3 border-b">
                <div className="flex items-center justify-between">
                  <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                  <Switch
                    checked={threshold.enabled}
                    onCheckedChange={(val) => updateThreshold(key, 'enabled', val)}
                  />
                </div>
                {threshold.enabled && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={threshold.value}
                      onChange={(e) => updateThreshold(key, 'value', parseFloat(e.target.value))}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">{threshold.unit}</span>
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose how you want to receive alerts</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <Label>In-App Notifications</Label>
                  <p className="text-xs text-muted-foreground">Show alerts in the dashboard</p>
                </div>
                <Switch
                  checked={config.notifications.inApp}
                  onCheckedChange={(val) => setConfig(prev => prev ? ({ ...prev, notifications: { ...prev.notifications, inApp: val } }) : prev)}
                />
              </div>

              <div className="space-y-2 py-2 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-xs text-muted-foreground">AI-written alerts delivered to your email</p>
                  </div>
                  <Switch
                    checked={config.notifications.email}
                    onCheckedChange={(val) => setConfig(prev => prev ? ({ ...prev, notifications: { ...prev.notifications, email: val } }) : prev)}
                  />
                </div>
                {config.notifications.email && (
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={(config.notifications as any).emailAddress || ''}
                    onChange={(e) => setConfig(prev => prev ? ({ ...prev, notifications: { ...prev.notifications, emailAddress: e.target.value } }) : prev)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Webhook</Label>
                    <p className="text-xs text-muted-foreground">Send alerts to a webhook URL</p>
                  </div>
                  <Switch
                    checked={config.notifications.webhook}
                    onCheckedChange={(val) => setConfig(prev => prev ? ({ ...prev, notifications: { ...prev.notifications, webhook: val } }) : prev)}
                  />
                </div>
                {config.notifications.webhook && (
                  <Input
                    placeholder="https://your-webhook-url.com"
                    value={config.notifications.webhookUrl || ''}
                    onChange={(e) => setConfig(prev => prev ? ({ ...prev, notifications: { ...prev.notifications, webhookUrl: e.target.value } }) : prev)}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="competitors" className="space-y-4">
            <p className="text-sm text-muted-foreground">Get alerted when competitor metrics change significantly</p>
            {(['volumeSpike', 'userGrowth', 'tvlChange'] as const).map(key => (
              <div key={key} className="flex items-center justify-between py-2 border-b">
                <div>
                  <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {key === 'volumeSpike' && 'Alert when a competitor volume spikes >30%'}
                    {key === 'userGrowth'  && 'Alert when a competitor gains users faster than you'}
                    {key === 'tvlChange'   && 'Alert when competitor TVL changes >20%'}
                  </p>
                </div>
                <Switch
                  checked={(config as any).competitorAlerts?.[key] ?? false}
                  onCheckedChange={(val) => setConfig(prev => prev ? ({
                    ...prev,
                    competitorAlerts: { ...(prev as any).competitorAlerts, [key]: val }
                  }) : prev)}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="agent" className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <Label className="font-semibold">Enable Agent Automation</Label>
                <p className="text-xs text-muted-foreground">Master switch — agent does nothing unless this is on</p>
              </div>
              <Switch
                checked={agentConfig.enabled}
                onCheckedChange={(val) => setAgentConfig((prev: any) => ({ ...prev, enabled: val }))}
              />
            </div>
            {([
              { key: 'createTasks',      label: 'Create Tasks',          desc: 'Agent can create tasks for failing metrics' },
              { key: 'autoAnalyze',      label: 'Auto-Analyze (Weekly)', desc: 'Run contract analysis every Monday automatically' },
              { key: 'sendDigests',      label: 'Send Digests',          desc: 'Daily and weekly briefing emails' },
              { key: 'postSocial',       label: 'Post to Social',        desc: 'Auto-generate and post social media updates' },
              { key: 'checkCompetitors', label: 'Monitor Competitors',   desc: 'Alert on competitor volume/TVL spikes' },
              { key: 'regressionAlerts', label: 'Regression Alerts',     desc: 'Alert when key metrics drop significantly' },
            ] as const).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b">
                <div>
                  <Label className={!agentConfig.enabled ? 'text-muted-foreground' : ''}>{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  disabled={!agentConfig.enabled}
                  checked={agentConfig.permissions?.[key] ?? false}
                  onCheckedChange={(val) => setAgentConfig((prev: any) => ({
                    ...prev,
                    permissions: { ...prev.permissions, [key]: val },
                  }))}
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex items-center justify-between">
          {message && (
            <div className={`flex items-center gap-2 text-sm ${isError ? 'text-red-600' : 'text-green-600'}`}>
              {isError
                ? <XCircle className="h-4 w-4" />
                : <CheckCircle className="h-4 w-4" />}
              <span>{message}</span>
            </div>
          )}
          <Button onClick={saveConfig} disabled={saving} className="ml-auto">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    security: 'Unusual patterns, exploits, suspicious addresses',
    performance: 'High gas usage, failed transactions, slow execution',
    liquidity: 'Low TVL, high slippage, liquidity drain',
    anomaly: 'Volume spikes, whale activity, unusual behavior',
    growth: 'Declining users, reduced activity, market changes'
  };
  return descriptions[category] || '';
}

function getSeverityDescription(severity: string): string {
  const descriptions: Record<string, string> = {
    critical: 'Immediate action required',
    high: 'Urgent attention needed',
    medium: 'Monitor closely',
    low: 'Informational only'
  };
  return descriptions[severity] || '';
}

function getSeverityVariant(severity: string): 'destructive' | 'default' | 'secondary' {
  const variants: Record<string, 'destructive' | 'default' | 'secondary'> = {
    critical: 'destructive',
    high: 'destructive',
    medium: 'default',
    low: 'secondary'
  };
  return variants[severity] || 'default';
}
