'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Save, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

export function AlertConfigurationPanel({ contractId = null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, [contractId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.alerts.getConfig();
      const existingConfig = contractId 
        ? response.configs.find(c => c.contractId === contractId)
        : response.configs.find(c => !c.contractId);
      
      setConfig(existingConfig || getDefaultConfig());
    } catch (error) {
      console.error('Failed to load config:', error);
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
    try {
      setSaving(true);
      setMessage('');
      
      if (config.id) {
        await api.alerts.updateConfig(config.id, config);
      } else {
        const response = await api.alerts.createConfig(config);
        setConfig(response.config);
      }
      
      setMessage('Configuration saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (category, value) => {
    setConfig(prev => ({
      ...prev,
      categories: { ...prev.categories, [category]: value }
    }));
  };

  const updateSeverity = (level, value) => {
    setConfig(prev => ({
      ...prev,
      severityLevels: { ...prev.severityLevels, [level]: value }
    }));
  };

  const updateThreshold = (key, field, value) => {
    setConfig(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [key]: { ...prev.thresholds[key], [field]: value }
      }
    }));
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
            onCheckedChange={(value) => setConfig(prev => ({ ...prev, enabled: value }))}
          />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="severity">Severity</TabsTrigger>
            <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
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
                  onCheckedChange={(val) => setConfig(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, inApp: val }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">Send alerts to your email</p>
                </div>
                <Switch
                  checked={config.notifications.email}
                  onCheckedChange={(val) => setConfig(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, email: val }
                  }))}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Webhook</Label>
                    <p className="text-xs text-muted-foreground">Send alerts to a webhook URL</p>
                  </div>
                  <Switch
                    checked={config.notifications.webhook}
                    onCheckedChange={(val) => setConfig(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, webhook: val }
                    }))}
                  />
                </div>
                {config.notifications.webhook && (
                  <Input
                    placeholder="https://your-webhook-url.com"
                    value={config.notifications.webhookUrl || ''}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, webhookUrl: e.target.value }
                    }))}
                  />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex items-center justify-between">
          {message && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-600">{message}</span>
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

function getCategoryDescription(category) {
  const descriptions = {
    security: 'Unusual patterns, exploits, suspicious addresses',
    performance: 'High gas usage, failed transactions, slow execution',
    liquidity: 'Low TVL, high slippage, liquidity drain',
    anomaly: 'Volume spikes, whale activity, unusual behavior',
    growth: 'Declining users, reduced activity, market changes'
  };
  return descriptions[category] || '';
}

function getSeverityDescription(severity) {
  const descriptions = {
    critical: 'Immediate action required',
    high: 'Urgent attention needed',
    medium: 'Monitor closely',
    low: 'Informational only'
  };
  return descriptions[severity] || '';
}

function getSeverityVariant(severity) {
  const variants = {
    critical: 'destructive',
    high: 'destructive',
    medium: 'default',
    low: 'secondary'
  };
  return variants[severity] || 'default';
}
