'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Header } from '@/components/ui/header';
import { AlertConfigurationPanel } from '@/components/alerts/alert-configuration-panel';
import { AlertList } from '@/components/alerts/alert-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AlertSettingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login?redirect=/alerts');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) return null;
  return (
    <div className="page-shell">
      <Header />
      <div className="page-container max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Alerts</h1>
          <p className="text-muted-foreground text-sm">Monitor anomalies and configure thresholds</p>
        </div>
        <Tabs defaultValue="alerts">
          <TabsList>
            <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>
          <TabsContent value="alerts" className="mt-4">
            <AlertList />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <AlertConfigurationPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
