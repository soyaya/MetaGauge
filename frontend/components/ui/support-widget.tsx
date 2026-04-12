'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type Msg = { role: 'user' | 'assistant' | 'system'; text: string };

export function SupportWidget() {
  const { isAuthenticated, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'ai' | 'contact'>('ai');
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', text: 'Hi! I\'m your MetaGauge assistant. Ask me anything about the app, or switch to "Contact Support" to send us a message.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (!isAuthenticated) return null;

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);

    try {
      if (mode === 'ai') {
        const res = await fetch(`${API}/api/support/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        setMessages(m => [...m, { role: 'assistant', text: data.reply || 'Sorry, I couldn\'t answer that.' }]);
      } else {
        const res = await fetch(`${API}/api/support/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: text, subject: 'In-app support request' }),
        });
        const data = await res.json();
        setMessages(m => [...m, { role: 'assistant', text: data.message || 'Message sent! We\'ll be in touch.' }]);
        setSent(true);
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Something went wrong. Try again or email support@metagauge.io' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-80 bg-background border border-border rounded-xl shadow-xl flex flex-col overflow-hidden" style={{ height: 420 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
            <div className="flex gap-1">
              <button onClick={() => { setMode('ai'); setSent(false); }}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${mode === 'ai' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                AI Assistant
              </button>
              <button onClick={() => { setMode('contact'); setSent(false); }}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${mode === 'contact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                Contact Support
              </button>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] text-xs rounded-lg px-3 py-2 ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t px-3 py-2 flex gap-2">
            <input
              className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 outline-none placeholder:text-muted-foreground"
              placeholder={mode === 'ai' ? 'Ask anything...' : 'Describe your issue...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading || sent}
            />
            <Button size="sm" className="h-8 w-8 p-0 shrink-0" onClick={send} disabled={loading || !input.trim() || sent}>
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Bubble */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>
    </div>
  );
}
