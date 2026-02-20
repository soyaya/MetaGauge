'use client';

import { Header } from '@/components/ui/header';
import { AlertConfigurationPanel } from '@/components/alerts/alert-configuration-panel';

export default function AlertSettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Alert Settings</h1>
          <p className="text-muted-foreground">
            Configure your alert preferences and set custom thresholds for AI-powered monitoring
          </p>
        </div>

        <AlertConfigurationPanel />
      </div>
    </div>
  );
}
