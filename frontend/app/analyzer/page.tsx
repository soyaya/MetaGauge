'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/ui/header';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';

// Import components
import { WizardStep } from '@/components/analyzer/wizard-step';
import { ChainSelector } from '@/components/analyzer/chain-selector';
import { LoadingScreen } from '@/components/analyzer/loading-screen';
import { DashboardHeader } from '@/components/analyzer/dashboard-header';
import { OverviewTab } from '@/components/analyzer/overview-tab';
import { MetricsTab } from '@/components/analyzer/metrics-tab';
import { UsersTab } from '@/components/analyzer/users-tab';
import { TransactionsTab } from '@/components/analyzer/transactions-tab';
import { CompetitiveTab } from '@/components/analyzer/competitive-tab';

// Import API
import { api, monitorAnalysis } from '@/lib/api';

// ============ TYPE & SCHEMA DEFINITIONS ============
const chainLogos = {
  ethereum: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
  lisk: 'https://cryptologos.cc/logos/lisk-lsk-logo.svg',
  starknet: 'https://cryptologos.cc/logos/starknet-token-strk-logo.svg',
};

const CompetitorSchema = z.object({
  name: z.string().optional().default(''),
  chain: z.string().optional().default(''),
  address: z.string().optional().default(''),
  abi: z.string().optional().default(''),
});

const WizardSchema = z.object({
  startupName: z.string().min(2, 'Startup name required (min 2 characters)'),
  chain: z.string().min(1, 'Chain required'),
  address: z.string().min(1, 'Contract address required'),
  abi: z.string().optional().default(''),
  competitors: z.array(CompetitorSchema).optional(),
  duration: z.enum(['7', '14', '30']).optional().default('7'),
});

type WizardFormData = z.infer<typeof WizardSchema>;

const CHAINS = Object.keys(chainLogos) as Array<keyof typeof chainLogos>;

// ============ MAIN PAGE COMPONENT ============
export default function OnChainAnalyzer() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [formData, setFormData] = useState<WizardFormData | null>(null);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState('overview');
  const [error, setError] = useState('');

  const form = useForm<WizardFormData>({
    resolver: zodResolver(WizardSchema),
    mode: 'onSubmit',
    defaultValues: {
      startupName: '',
      chain: '',
      address: '',
      abi: '',
      competitors: [],
      duration: '7',
    },
  });

  const { fields: competitorFields, append: appendCompetitor, remove: removeCompetitor } = useFieldArray({
    control: form.control,
    name: 'competitors',
  });

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=analyzer');
      return;
    }

    if (isAuthenticated) {
      checkOnboardingStatus();
    }
  }, [authLoading, isAuthenticated, router]);

  const checkOnboardingStatus = async () => {
    try {
      const onboardingStatus = await api.onboarding.getStatus();
      if (!onboardingStatus.completed) {
        router.push('/onboarding');
        return;
      }
      
      // Load user metrics for the analysis page
      loadUserMetrics();
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
    }
  };

  const loadUserMetrics = async () => {
    try {
      const metrics = await api.onboarding.getUserMetrics();
      // You can use these metrics to show user's overall analysis statistics
      console.log('User metrics loaded:', metrics);
    } catch (error) {
      console.error('Failed to load user metrics:', error);
    }
  };

  // Load pending address from localStorage
  useEffect(() => {
    const pendingAddress = localStorage.getItem('pendingAnalysisAddress');
    if (pendingAddress) {
      form.setValue('address', pendingAddress);
      localStorage.removeItem('pendingAnalysisAddress');
    }
  }, [form]);

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  async function onSubmit(data: WizardFormData) {
    setIsLoading(true);
    setError('');
    setFormData(data);
    
    try {
      setLoadingStatus('Creating configuration...');
      
      // Create custom configuration - always required now
      const configData = {
        name: `${data.startupName} Analysis`,
        description: `Analysis for ${data.startupName} on ${data.chain}`,
        targetContract: {
          address: data.address,
          chain: data.chain,
          name: data.startupName,
          abi: data.abi || ''
        },
        competitors: data.competitors?.filter(comp => comp.address && comp.chain).map(comp => ({
          address: comp.address,
          chain: comp.chain,
          name: comp.name || 'Competitor',
          abi: comp.abi || ''
        })) || [],
        analysisParams: {
          blockRange: parseInt(data.duration) * 1000, // Convert days to approximate blocks
          whaleThreshold: 10,
          maxConcurrentRequests: 5,
          failoverTimeout: 60000,
          maxRetries: 2
        }
      };
      const config = await api.contracts.create(configData);

      setLoadingStatus('Starting analysis...');
      
      // Start analysis
      const analysisType = data.competitors && data.competitors.length > 0 ? 'competitive' : 'single';
      const analysis = await api.analysis.start(config.id || config.config?.id, analysisType);
      
      // Store analysis ID
      setAnalysisId(analysis.analysisId);
      
      setLoadingStatus('Analyzing blockchain data...');
      
      // Monitor analysis progress
      const results = await monitorAnalysis(analysis.analysisId, (status) => {
        setLoadingStatus(`Analysis ${status.progress}% complete...`);
      });
      
      setAnalysisResults(results);
      setIsLoading(false);
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message || 'Analysis failed. Please try again.');
      setIsLoading(false);
    }
  }

  // Show loading screen
  if (isLoading) {
    return <LoadingScreen startupName={formData?.startupName || 'Your Protocol'} status={loadingStatus} />;
  }

  // Show dashboard after analysis
  if (analysisResults && !isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="px-6 py-8 max-w-7xl mx-auto">
          <DashboardHeader 
            startupName={formData?.startupName || 'Analysis'} 
            chain={formData?.chain || 'unknown'} 
            analysisResults={analysisResults}
          />

          <Tabs value={dashboardTab} onValueChange={setDashboardTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-8">
              <TabsTrigger value="overview" className="text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="metrics" className="text-sm">
                Metrics
              </TabsTrigger>
              <TabsTrigger value="users" className="text-sm">
                Users
              </TabsTrigger>
              <TabsTrigger value="transactions" className="text-sm">
                Transactions
              </TabsTrigger>
              <TabsTrigger value="competitive" className="text-sm">
                Competitive
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab analysisResults={analysisResults} analysisId={analysisId || undefined} />
            </TabsContent>

            <TabsContent value="metrics">
              <MetricsTab analysisResults={analysisResults} />
            </TabsContent>

            <TabsContent value="users">
              <UsersTab analysisResults={analysisResults} />
            </TabsContent>

            <TabsContent value="transactions">
              <TransactionsTab analysisResults={analysisResults} />
            </TabsContent>

            <TabsContent value="competitive">
              <CompetitiveTab analysisResults={analysisResults} />
            </TabsContent>
          </Tabs>

          <div className="mt-12 p-6 bg-card border rounded-lg text-center">
            <p className="text-muted-foreground text-sm">
              Generated by <span className="text-foreground font-semibold">MetaGauge</span> •{' '}
              <Button
                onClick={() => alert('PDF export initiated!')}
                variant="outline"
                size="sm"
              >
                Export PDF
              </Button>
            </p>
          </div>

          <div className="mt-6 text-center">
            <Button
              onClick={() => {
                setFormData(null);
                setAnalysisResults(null);
                form.reset();
                setStep(0);
                setDashboardTab('overview');
                setError('');
              }}
              variant="outline"
            >
              New Analysis
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Show wizard form
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-6 py-8 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
            OnChain Analyzer
          </h1>
          <p className="text-muted-foreground text-lg">
            Analyze your blockchain contract and compare with competitors
          </p>
        </div>

        <WizardStep step={step} totalSteps={3} />

        <Card className="shadow-lg">
          <CardContent className="pt-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Startup Name</label>
                    <input
                      type="text"
                      placeholder="e.g., MetaDEX Pro"
                      {...form.register('startupName')}
                      className={`w-full px-4 py-3 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all ${
                        form.formState.errors.startupName
                          ? 'border-destructive focus:ring-destructive/20'
                          : 'border-input focus:border-ring'
                      }`}
                    />
                    {form.formState.errors.startupName && (
                      <p className="text-destructive text-sm mt-1">{form.formState.errors.startupName.message}</p>
                    )}
                  </div>

                  <ChainSelector
                    value={form.watch('chain')}
                    onChange={(chain) => form.setValue('chain', chain)}
                    error={form.formState.errors.chain?.message}
                    chainLogos={chainLogos}
                    chains={CHAINS}
                  />

                  <div>
                    <label className="block text-sm font-medium mb-2">Contract Address *</label>
                    <input
                      type="text"
                      placeholder="0x..."
                      {...form.register('address')}
                      className={`w-full px-4 py-3 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all font-mono ${
                        form.formState.errors.address
                          ? 'border-destructive focus:ring-destructive/20'
                          : 'border-input focus:border-ring'
                      }`}
                    />
                    {form.formState.errors.address && (
                      <p className="text-destructive text-sm mt-1">{form.formState.errors.address.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Contract ABI</label>
                    <textarea
                      placeholder="Paste your contract ABI JSON here..."
                      {...form.register('abi')}
                      className="w-full px-4 py-3 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all font-mono text-xs"
                      rows={4}
                    />
                    <p className="text-muted-foreground text-xs mt-1">
                      Leave empty to use standard ERC-20 ABI
                    </p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <p className="text-muted-foreground">Add up to 3 competitors (optional)</p>
                  
                  {competitorFields.map((field, index) => (
                    <Card key={field.id} className="border-muted">
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-semibold">Competitor {index + 1}</h3>
                          <Button
                            type="button"
                            onClick={() => removeCompetitor(index)}
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/30"
                          >
                            Remove
                          </Button>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">Name</label>
                          <input
                            type="text"
                            placeholder="Competitor name"
                            {...form.register(`competitors.${index}.name`)}
                            className="w-full px-3 py-2 bg-background border border-input rounded focus:outline-none focus:border-ring"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">Chain</label>
                          <div className="grid grid-cols-3 gap-2">
                            {CHAINS.map((chain) => (
                              <button
                                key={chain}
                                type="button"
                                onClick={() => form.setValue(`competitors.${index}.chain`, chain)}
                                className={`p-2 rounded text-xs font-semibold transition-colors ${
                                  form.watch(`competitors.${index}.chain`) === chain
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                {chain.slice(0, 3).toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">Address</label>
                          <input
                            type="text"
                            placeholder="0x..."
                            {...form.register(`competitors.${index}.address`)}
                            className="w-full px-3 py-2 bg-background border border-input rounded focus:outline-none focus:border-ring font-mono text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">ABI</label>
                          <textarea
                            placeholder="Paste competitor ABI JSON here..."
                            {...form.register(`competitors.${index}.abi`)}
                            className="w-full px-3 py-2 bg-background border border-input rounded focus:outline-none focus:border-ring font-mono text-xs"
                            rows={3}
                          />
                          <p className="text-muted-foreground text-xs mt-1">
                            Leave empty to use standard ERC-20 ABI
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {competitorFields.length < 3 && (
                    <Button
                      type="button"
                      onClick={() =>
                        appendCompetitor({
                          name: '',
                          chain: '',
                          address: '',
                          abi: '',
                        })
                      }
                      variant="outline"
                      className="w-full"
                    >
                      Add Competitor
                    </Button>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <p className="text-sm">
                        <span className="font-semibold">Ready to analyze?</span> Click "Analyze Now" to scan your blockchain contract and compare with competitors. Analysis will complete in a few seconds.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex gap-3 pt-6">
                {step > 0 && (
                  <Button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    variant="outline"
                    className="flex-1"
                  >
                    Back
                  </Button>
                )}
                
                {step < 2 ? (
                  <Button
                    type="button"
                    onClick={async () => {
                      if (step === 0) {
                        // Validate required fields for step 0
                        const isValid = await form.trigger(['startupName', 'chain', 'address']);
                        if (isValid) {
                          setStep(step + 1);
                        }
                      } else {
                        // For other steps, just proceed (competitors are optional)
                        setStep(step + 1);
                      }
                    }}
                    className="flex-1"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="flex-1 text-lg font-semibold h-12"
                  >
                    Analyze Now
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}