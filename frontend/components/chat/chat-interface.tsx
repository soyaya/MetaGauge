'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { SuggestedQuestions } from './suggested-questions';
import { Send, Lightbulb } from 'lucide-react';
import { api } from '@/lib/api';

interface ChatSession {
  id: string;
  title: string;
  contractAddress: string;
  contractChain: string;
  contractName: string;
  lastMessageAt: string;
  messageCount: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  components: any[];
  createdAt: string;
  metadata?: any;
}

interface ChatInterfaceProps {
  session: ChatSession;
  onSessionUpdate: (session: ChatSession) => void;
  onContractContextUpdate: (context: any) => void;
}

export function ChatInterface({ session, onSessionUpdate, onContractContextUpdate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [contractContext, setContractContext] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load messages when session changes
  useEffect(() => {
    if (session) {
      loadMessages();
      loadSessionDetails();
    }
  }, [session.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const response = await api.chat.getMessages(session.id);
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadSessionDetails = async () => {
    try {
      const response = await api.chat.getSession(session.id);
      setContractContext(response.contractContext);
      onContractContextUpdate(response.contractContext);
      
      // Generate suggested questions if no messages yet
      if (messages.length <= 1) {
        const suggestedResponse = await api.chat.getSuggestedQuestions(session.contractAddress, session.contractChain);
        setSuggestedQuestions(suggestedResponse.questions || []);
      }
    } catch (error) {
      console.error('Failed to load session details:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const messageContent = content.trim();
    setInputValue('');
    setIsLoading(true);
    setShowSuggestions(false); // Hide suggestions panel when sending message

    try {
      const response = await api.chat.sendMessage(session.id, messageContent);
      
      // Add both user and assistant messages
      setMessages(prev => [
        ...prev,
        response.userMessage,
        response.assistantMessage
      ]);

      // Update session info
      onSessionUpdate({
        ...session,
        lastMessageAt: response.assistantMessage.createdAt,
        messageCount: session.messageCount + 2
      });

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Add error message
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant' as const,
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        components: [{
          type: 'alert',
          data: {
            severity: 'error',
            title: 'Error',
            message: 'Failed to process your message. Please try again.',
            actionable: false
          }
        }],
        createdAt: new Date().toISOString(),
        metadata: { error: true }
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const toggleSuggestions = async () => {
    if (!showSuggestions && suggestedQuestions.length === 0) {
      // Load suggestions if not already loaded
      try {
        const suggestedResponse = await api.chat.getSuggestedQuestions(session.contractAddress, session.contractChain);
        setSuggestedQuestions(suggestedResponse.questions || []);
      } catch (error) {
        console.error('Failed to load suggestions:', error);
      }
    }
    setShowSuggestions(!showSuggestions);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto py-4 px-2 sm:px-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLoading={isLoading && message.id === messages[messages.length - 1]?.id}
              />
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-muted rounded-lg p-4 max-w-xs">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Suggested Questions */}
      {showSuggestions && suggestedQuestions.length > 0 && (
        <div className="flex-shrink-0 px-2 sm:px-4 py-3 border-t border-border bg-muted/20">
          <SuggestedQuestions
            questions={suggestedQuestions}
            onQuestionClick={handleSuggestedQuestion}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 p-2 sm:p-4 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-2">
            <div className="flex-1 min-w-0 relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about this contract..."
                disabled={isLoading}
                className="min-h-[44px] resize-none w-full pr-12"
              />
              
              {/* Suggestions Button - Inside input on the right */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSuggestions}
                className={`absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted transition-colors z-10 ${
                  showSuggestions ? 'bg-primary/10 text-primary' : ''
                }`}
                title={showSuggestions ? "Hide suggestions" : "Show suggestions"}
                type="button"
              >
                <Lightbulb className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
              className="h-[44px] px-3 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2 text-center">
            AI responses include interactive charts and visualizations based on contract data.
          </p>
        </div>
      </div>
    </div>
  );
}