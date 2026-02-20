'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/ui/header';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, Globe, Twitter, MessageCircle, Send, Upload } from 'lucide-react';

const OnboardingSchema = z.object({
  // Social links
  website: z.string().url().optional().or(z.literal('')),
  twitter: z.string().optional(),
  discord: z.string().optional(),
  telegram: z.string().optional(),
  
  // Logo
  logo: z.string().optional(),
  
  // Contract details
  contractAddress: z.string().min(1, 'Contract address is required'),
  chain: z.string().min(1, 'Chain selection is required'),
  contractName: z.string().min(2, 'Contract name must be at least 2 characters'),
  abi: z.string().optional(),
  purpose: z.string().min(10, 'Purpose must be at least 10 characters'),
  category: z.string().min(1, 'Category selection is required'),
  startDate: z.string().optional(), // Optional - for user reference only
});

type OnboardingFormData = z.infer<typeof OnboardingSchema>;

const CHAINS = [
  { value: 'ethereum', label: 'Ethereum', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg' },
  { value: 'lisk', label: 'Lisk', logo: 'https://cryptologos.cc/logos/lisk-lsk-logo.svg' },
  { value: 'starknet', label: 'Starknet', logo: 'https://cryptologos.cc/logos/starknet-token-strk-logo.svg' },
];

const CATEGORIES = [
  { value: 'defi', label: 'DeFi', description: 'Decentralized Finance protocols' },
  { value: 'nft', label: 'NFT', description: 'Non-Fungible Token collections' },
  { value: 'gaming', label: 'Gaming', description: 'Blockchain gaming platforms' },
  { value: 'dao', label: 'DAO', description: 'Decentralized Autonomous Organizations' },
  { value: 'infrastructure', label: 'Infrastructure', description: 'Blockchain infrastructure services' },
  { value: 'other', label: 'Other', description: 'Other blockchain applications' },
];

export default function OnboardingPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(OnboardingSchema),
    mode: 'onSubmit',
    defaultValues: {
      website: '',
      twitter: '',
      discord: '',
      telegram: '',
      logo: '',
      contractAddress: '',
      chain: '',
      contractName: '',
      abi: '',
      purpose: '',
      category: '',
      startDate: '',
    },
  });

  // Check authentication and onboarding status
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=onboarding');
      return;
    }

    if (isAuthenticated) {
      checkOnboardingStatus();
    }
  }, [authLoading, isAuthenticated, router]);

  const checkOnboardingStatus = async () => {
    try {
      const response = await api.onboarding.getStatus();
      if (response.completed) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
    }
  };

  const onSubmit = async (data: OnboardingFormData) => {
    try {
      setIsSubmitting(true);
      setError('');

      const onboardingData = {
        socialLinks: {
          website: data.website || null,
          twitter: data.twitter || null,
          discord: data.discord || null,
          telegram: data.telegram || null,
        },
        logo: data.logo || null,
        contractAddress: data.contractAddress,
        chain: data.chain,
        contractName: data.contractName,
        abi: data.abi || null,
        purpose: data.purpose,
        category: data.category,
        startDate: data.startDate,
      };

      const response = await api.onboarding.complete(onboardingData);
      
      // Redirect immediately - indexing happens in background
      router.push('/dashboard');

    } catch (error: any) {
      setError(error.message || 'Failed to complete onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome to Contract Analytics</h1>
          <p className="text-muted-foreground">
            Let's set up your default contract for personalized analytics
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Step {step} of 3</span>
            <span className="text-sm text-muted-foreground">
              {step === 1 && 'Project Information'}
              {step === 2 && 'Contract Details'}
              {step === 3 && 'Review & Submit'}
            </span>
          </div>
          <Progress value={(step / 3) * 100} className="h-2" />
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Step 1: Project Information */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Project Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="website">Website URL</Label>
                  <Input
                    id="website"
                    placeholder="https://yourproject.com"
                    {...form.register('website')}
                  />
                  {form.formState.errors.website && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.website.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="twitter">Twitter Handle</Label>
                    <div className="relative">
                      <Twitter className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="twitter"
                        placeholder="@yourproject"
                        className="pl-10"
                        {...form.register('twitter')}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="discord">Discord Server</Label>
                    <div className="relative">
                      <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="discord"
                        placeholder="discord.gg/yourserver"
                        className="pl-10"
                        {...form.register('discord')}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="telegram">Telegram Channel</Label>
                  <div className="relative">
                    <Send className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="telegram"
                      placeholder="t.me/yourchannel"
                      className="pl-10"
                      {...form.register('telegram')}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="logo">Logo URL (Optional)</Label>
                  <div className="relative">
                    <Upload className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="logo"
                      placeholder="https://yourproject.com/logo.png"
                      className="pl-10"
                      {...form.register('logo')}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" onClick={nextStep}>
                    Next Step
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Contract Details */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Contract Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="contractName">Contract Name *</Label>
                  <Input
                    id="contractName"
                    placeholder="My DeFi Protocol"
                    {...form.register('contractName')}
                  />
                  {form.formState.errors.contractName && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.contractName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="chain">Blockchain *</Label>
                  <Select onValueChange={(value) => form.setValue('chain', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blockchain" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHAINS.map((chain) => (
                        <SelectItem key={chain.value} value={chain.value}>
                          <div className="flex items-center gap-2">
                            <img src={chain.logo} alt={chain.label} className="w-4 h-4" />
                            {chain.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.chain && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.chain.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="contractAddress">Contract Address *</Label>
                  <Input
                    id="contractAddress"
                    placeholder="0x..."
                    {...form.register('contractAddress')}
                  />
                  {form.formState.errors.contractAddress && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.contractAddress.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select onValueChange={(value) => form.setValue('category', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          <div>
                            <div className="font-medium">{category.label}</div>
                            <div className="text-sm text-muted-foreground">{category.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.category && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.category.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="startDate">Project Start Date (Optional)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    For your reference only. The onboarding date will be used in the dashboard.
                  </p>
                  <Input
                    id="startDate"
                    type="date"
                    {...form.register('startDate')}
                  />
                  {form.formState.errors.startDate && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.startDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="purpose">Project Purpose *</Label>
                  <Textarea
                    id="purpose"
                    placeholder="Describe what your contract does and its main purpose..."
                    rows={3}
                    {...form.register('purpose')}
                  />
                  {form.formState.errors.purpose && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.purpose.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="abi">Contract ABI</Label>
                  <Textarea
                    id="abi"
                    placeholder="Paste your contract ABI JSON here for enhanced analysis..."
                    rows={4}
                    {...form.register('abi')}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Providing ABI enables more detailed event and function analysis
                  </p>
                </div>

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={prevStep}>
                    Previous
                  </Button>
                  <Button type="button" onClick={nextStep}>
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Review & Submit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Project Information</h3>
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    {form.watch('website') && (
                      <p><strong>Website:</strong> {form.watch('website')}</p>
                    )}
                    {form.watch('twitter') && (
                      <p><strong>Twitter:</strong> {form.watch('twitter')}</p>
                    )}
                    {form.watch('discord') && (
                      <p><strong>Discord:</strong> {form.watch('discord')}</p>
                    )}
                    {form.watch('telegram') && (
                      <p><strong>Telegram:</strong> {form.watch('telegram')}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Contract Details</h3>
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <p><strong>Name:</strong> {form.watch('contractName')}</p>
                    <p><strong>Chain:</strong> {CHAINS.find(c => c.value === form.watch('chain'))?.label}</p>
                    <p><strong>Address:</strong> {form.watch('contractAddress')}</p>
                    <p><strong>Category:</strong> {CATEGORIES.find(c => c.value === form.watch('category'))?.label}</p>
                    <p><strong>Start Date:</strong> {form.watch('startDate')}</p>
                    <p><strong>Purpose:</strong> {form.watch('purpose')}</p>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={prevStep}>
                    Previous
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      'Complete Setup'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}