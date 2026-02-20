'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContractSelectorModal } from './contract-selector-modal';
import { 
  Plus, 
  Search,
  MessageCircle,
  Trash2,
  Edit
} from 'lucide-react';
import { api } from '@/lib/api';

interface ChatSession {
  id: string;
  title: string;
  contractAddress: string;
  contractChain: string;
  contractName: string;
  lastMessageAt: string;
  messageCount: number;
  createdAt: string;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onSessionsUpdate: () => void;
  onContractSelect: (contractAddress: string, contractChain: string, contractName: string) => void;
}

export function ChatSidebar({ 
  sessions, 
  currentSession, 
  onSessionSelect, 
  onNewChat,
  onSessionsUpdate,
  onContractSelect
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showContractSelector, setShowContractSelector] = useState(false);

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.contractName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.contractAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this chat session?')) {
      return;
    }

    try {
      await api.chat.deleteSession(sessionId);
      onSessionsUpdate();
      
      // If we deleted the current session, clear it
      if (currentSession?.id === sessionId) {
        onNewChat();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleEditSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setEditingSession(sessionId);
      setEditTitle(session.title);
    }
  };

  const handleSaveEdit = async (sessionId: string) => {
    try {
      await api.chat.updateSession(sessionId, { title: editTitle });
      setEditingSession(null);
      setEditTitle('');
      onSessionsUpdate();
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
    setEditTitle('');
  };

  const handleNewChat = () => {
    setShowContractSelector(true);
  };

  const handleContractSelect = (contract: any) => {
    onContractSelect(
      contract.targetContract.address,
      contract.targetContract.chain,
      contract.targetContract.name || contract.name
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getChainColor = (chain: string) => {
    const colors = {
      ethereum: 'bg-blue-100 text-blue-800',
      lisk: 'bg-green-100 text-green-800',
      starknet: 'bg-purple-100 text-purple-800',
    };
    return colors[chain as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-72 xl:w-80 border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-3 xl:p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Contract Chats</h2>
          <Button
            onClick={handleNewChat}
            size="sm"
            className="h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="p-1 xl:p-2">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">
                {searchQuery ? 'No chats found' : 'No chat sessions yet'}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                {searchQuery ? 'Try a different search term' : 'Start analyzing a contract to begin'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => onSessionSelect(session.id)}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                    currentSession?.id === session.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Session Content */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {editingSession === session.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="h-7 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit(session.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(session.id)}
                              className="h-6 px-2 text-xs"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="h-6 px-2 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-medium text-sm truncate mb-1">
                            {session.title}
                          </h3>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getChainColor(session.contractChain)}`}>
                              {session.contractChain}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {session.contractAddress.slice(0, 8)}...
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{session.messageCount} messages</span>
                            <span>{formatDate(session.lastMessageAt || session.createdAt)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {editingSession !== session.id && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => handleEditSession(session.id, e)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 xl:p-4 border-t border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground text-center">
          AI-powered contract analysis
        </p>
      </div>

      {/* Contract Selector Modal */}
      <ContractSelectorModal
        isOpen={showContractSelector}
        onClose={() => setShowContractSelector(false)}
        onContractSelect={handleContractSelect}
      />
    </div>
  );
}