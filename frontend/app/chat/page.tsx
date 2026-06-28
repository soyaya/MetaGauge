'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/ui/header';
import { useAuth } from '@/components/auth/auth-provider';
import { ChatInterface } from '@/components/chat/chat-interface';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { ContractDetailsSidebar } from '@/components/chat/contract-details-sidebar';
import { Button } from '@/components/ui/button';
import { PanelRightOpen, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

function ChatPageContent() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [contractContext, setContractContext] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);

  // Get contract info from URL params
  const contractAddress = searchParams.get('address');
  const contractChain = searchParams.get('chain');
  const contractName = searchParams.get('name');

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=chat');
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  // Load chat sessions
  useEffect(() => {
    if (isAuthenticated) {
      loadChatSessions().finally(() => setIsLoading(false));
    }
  }, [isAuthenticated]);

  // Create or load session for specific contract
  useEffect(() => {
    if (isAuthenticated && contractAddress && contractChain) {
      createOrLoadContractSession();
    }
  }, [isAuthenticated, contractAddress, contractChain]);

  const loadChatSessions = async () => {
    setError('');
    try {
      const response = await api.chat.getSessions();
      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      setError('Failed to load chat sessions');
    }
  };

  const createOrLoadContractSession = async () => {
    if (!contractAddress || !contractChain) return;
    setError('');
    try {
      setIsLoading(true);
      const response = await api.chat.createSession({
        contractAddress,
        contractChain,
        contractName: contractName || 'Unknown Contract'
      });
      
      setCurrentSession(response.session);
      
      // Update sessions list
      await loadChatSessions();
    } catch (error) {
      console.error('Failed to create/load session:', error);
      setError('Failed to create chat session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionSelect = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const response = await api.chat.getSession(sessionId);
      setCurrentSession(response.session);
      setContractContext(response.contractContext);
      
      // Update URL without contract params
      router.push('/chat');
    } catch (error) {
      console.error('Failed to load session:', error);
      setError('Failed to load chat session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentSession(null);
    setContractContext(null);
    setError('');
    router.push('/chat');
  };

  const handleContractSelect = async (contractAddress: string, contractChain: string, contractName: string) => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await api.chat.createSession({
        contractAddress,
        contractChain,
        contractName
      });
      
      setCurrentSession(response.session);
      setContractContext(response.contractContext);
      
      // Update sessions list
      await loadChatSessions();
      
      // Update URL to show the new chat
      router.push('/chat');
    } catch (error) {
      console.error('Failed to create chat session:', error);
      setError('Failed to create chat session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContractContextUpdate = (context: any) => {
    setContractContext(context);
  };

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="page-shell">
      <Header />
      
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {showSidebar && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowSidebar(false)} />
            <div className="relative z-50 w-72 h-full bg-background border-r border-border shadow-xl">
              <ChatSidebar
                sessions={sessions}
                currentSession={currentSession}
                onSessionSelect={(id) => { handleSessionSelect(id); setShowSidebar(false); }}
                onNewChat={() => { handleNewChat(); setShowSidebar(false); }}
                onSessionsUpdate={loadChatSessions}
                onContractSelect={(a, c, n) => { handleContractSelect(a, c, n); setShowSidebar(false); }}
              />
            </div>
          </div>
        )}

        {/* Left Sidebar - Sessions (desktop) */}
        <div className="flex-shrink-0 w-72 xl:w-80 hidden lg:block h-full border-r border-border">
          <ChatSidebar
            sessions={sessions}
            currentSession={currentSession}
            onSessionSelect={handleSessionSelect}
            onNewChat={handleNewChat}
            onSessionsUpdate={loadChatSessions}
            onContractSelect={handleContractSelect}
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {currentSession ? (
              <>
                {/* Mobile top bar */}
                <div className="lg:hidden border-b border-border p-2 flex items-center justify-between bg-card flex-shrink-0 gap-2">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setShowSidebar(true)}>
                    <PanelRightOpen className="h-4 w-4 rotate-180" />
                  </Button>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{currentSession.contractName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">({currentSession.contractChain})</span>
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <ChatInterface
                    session={currentSession}
                    onSessionUpdate={(updatedSession: any) => {
                      setCurrentSession(updatedSession);
                      loadChatSessions();
                    }}
                    onContractContextUpdate={handleContractContextUpdate}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                  {/* Mobile: show "browse sessions" button when no session selected */}
                  <Button variant="outline" size="sm" className="lg:hidden mb-6" onClick={() => setShowSidebar(true)}>
                    Browse sessions
                  </Button>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-2">Welcome to Contract Chat</h2>
                  <p className="text-muted-foreground mb-6 text-sm sm:text-base">
                    Start a conversation about any smart contract. Get AI-powered insights, 
                    analysis, and recommendations with interactive charts and data visualizations.
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground text-left inline-block">
                    <p>• Ask questions about contract performance</p>
                    <p>• Get transaction and user analysis</p>
                    <p>• Compare with competitors</p>
                    <p>• Receive security insights</p>
                  </div>
                  
                  {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Contract Details (desktop 2xl+) */}
          <div className="flex-shrink-0 w-80 hidden 2xl:block h-full border-l border-border">
            <ContractDetailsSidebar 
              session={currentSession}
              contractContext={contractContext}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="page-shell">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}