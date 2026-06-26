'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type PendingAction = {
  kind: 'leave_request' | 'leave_review';
  token: string;
  summary: string;
};

const WELCOME_MESSAGE = `Pozdrav! Ja sam Bloomie asistent za godišnje odmore.

Možete me pitati npr.:
• „Koliko mi je ostalo godišnjeg?"
• „Tko je na godišnjem ovaj tjedan?"
• „Želim godišnji od 14. do 25. augusta"`;

export function ChatWidget({ userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const loadConversation = useCallback(async () => {
    try {
      const res = await fetch('/api/chat');
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: ChatMessage[];
        pendingAction: PendingAction | null;
      };
      setMessages(
        (data.messages || []).filter(
          (m): m is ChatMessage => m.role === 'user' || m.role === 'assistant'
        )
      );
      setPendingAction(data.pendingAction);
    } catch {
      // ignore hydrate errors
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (open && !hydrated) {
      void loadConversation();
    }
  }, [open, hydrated, loadConversation]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages, pendingAction, scrollToBottom]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error || 'Greška pri slanju poruke.' },
        ]);
        return;
      }

      setMessages(
        (data.messages || []).filter(
          (m: ChatMessage) => m.role === 'user' || m.role === 'assistant'
        )
      );
      setPendingAction(data.pendingAction ?? null);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Greška pri povezivanju. Pokušajte ponovo.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: 'confirm' | 'cancel' | 'review_confirm' | 'review_cancel') {
    if (!pendingAction || actionLoading) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/chat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pendingAction.token, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error || 'Akcija nije uspjela.' },
        ]);
        return;
      }

      setMessages(
        (data.messages || []).filter(
          (m: ChatMessage) => m.role === 'user' || m.role === 'assistant'
        )
      );
      setPendingAction(null);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Greška pri obradi akcije.' },
      ]);
    } finally {
      setActionLoading(false);
    }
  }

  const displayMessages = messages.length === 0 ? [{ role: 'assistant' as const, content: WELCOME_MESSAGE }] : messages;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 lg:bottom-8 lg:right-8">
      {open ? (
        <div
          className={cn(
            'flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl',
            'h-[min(32rem,70vh)] z-[45]'
          )}
        >
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Image
              src="/chatbot-avatar.png"
              alt="Bloomie asistent"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg leading-tight">Bloomie asistent</h2>
              <p className="truncate text-xs text-muted-foreground">Pozdrav, {userName}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Zatvori chat"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {displayMessages.map((msg, index) => (
              <div
                key={`${msg.role}-${index}`}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Razmišljam...
                </div>
              </div>
            ) : null}

            {pendingAction ? (
              <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-3">
                <p className="text-sm whitespace-pre-wrap">{pendingAction.summary}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() =>
                      void handleAction(
                        pendingAction.kind === 'leave_review' ? 'review_confirm' : 'confirm'
                      )
                    }
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Potvrdi'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() =>
                      void handleAction(
                        pendingAction.kind === 'leave_review' ? 'review_cancel' : 'cancel'
                      )
                    }
                  >
                    Odustani
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <footer className="border-t border-border p-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pitajte o godišnjem..."
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
                <span className="sr-only">Pošalji</span>
              </Button>
            </form>
          </footer>
        </div>
      ) : null}

      <Button
        type="button"
        size="icon"
        aria-label="Otvori Bloomie asistent"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="h-14 w-14 rounded-full shadow-lg overflow-hidden p-0 border-2 border-primary/20 hover:scale-105 transition-transform"
      >
        <Image
          src="/chatbot-avatar.png"
          alt=""
          width={56}
          height={56}
          className="h-full w-full object-cover"
        />
      </Button>
    </div>
  );
}
