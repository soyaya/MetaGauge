'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Search,
  ExternalLink,
  MessageCircle
} from 'lucide-react';
import { api } from '@/lib/api';

interface Contract {
  id: string;
  name: string;
  description: string;
  targetContract: {
    address: string;
    chain: string;
    name: string;
  };
  tags: string[];
  createdAt: string;
}

interface ContractSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContractSelect: (contract: Contract) => void;
}

export function ContractSelectorModal({ 
  isOpen, 
  onClose, 
  onContractSelect 
}: ContractSelectorModalProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadContracts();
    }
  }, [isOpen]);

  const loadContracts = async () => {
    try {
      setIsLoading(true);
      const response = await api.contracts.list();
      setContracts(response.contracts || []);
    } catch (error) {
      console.error('Failed to load contracts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContracts = contracts.filter(contract =>
    contract.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.targetContract.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.targetContract.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContractSelect = (contract: Contract) => {
    onContractSelect(contract);
    onClose();
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Start New Chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contracts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Contract List */}
          <ScrollArea className="h-96">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No contracts found' : 'No contracts configured'}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  {searchQuery ? 'Try a different search term' : 'Add a contract configuration first'}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => window.open('/analyzer', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Configure Contract
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContracts.map((contract) => (
                  <div
                    key={contract.id}
                    onClick={() => handleContractSelect(contract)}
                    className="p-4 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm mb-1">
                          {contract.name}
                        </h3>
                        {contract.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {contract.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getChainColor(contract.targetContract.chain)}`}>
                            {contract.targetContract.chain}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {contract.targetContract.address.slice(0, 8)}...{contract.targetContract.address.slice(-6)}
                          </span>
                        </div>
                        {contract.tags && contract.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {contract.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                            {contract.tags.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{contract.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}