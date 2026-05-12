'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

type SearchUser = {
  id: string;
  name: string;
  email: string;
};

export function AddExistingMemberForm({ projectSlug }: { projectSlug: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser | null>(null);
  const [role, setRole] = useState<'employee' | 'lead' | 'admin'>('employee');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      const response = await fetch(
        `/api/users/search?projectSlug=${encodeURIComponent(projectSlug)}&q=${encodeURIComponent(query.trim())}`
      );
      const payload = await response.json().catch(() => ({ users: [] }));
      setIsSearching(false);
      setResults(payload.users || []);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [projectSlug, query]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      toast.error('Select a user from search results');
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selected.id, role }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to add member');
      return;
    }

    toast.success(`${selected.name} added to the project`);
    setQuery('');
    setSelected(null);
    setResults([]);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="font-display text-lg">Add existing user</h2>
          <p className="text-sm text-muted-foreground">
            Search by name or email. We send an info email when someone is added directly.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="existing-user-search">Search</Label>
            <Input
              id="existing-user-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
              }}
              placeholder="Start typing a name or email"
              disabled={isSubmitting}
            />
            {isSearching ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
            {results.length > 0 ? (
              <div className="rounded-md border border-border bg-card">
                {results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => setSelected(result)}
                    className={`flex w-full items-start justify-between px-3 py-2 text-left text-sm hover:bg-accent/50 ${
                      selected?.id === result.id ? 'bg-accent/60' : ''
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{result.name}</span>
                      <span className="block text-muted-foreground">{result.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="existing-user-role">Role</Label>
            <select
              id="existing-user-role"
              value={role}
              onChange={(event) => setRole(event.target.value as 'employee' | 'lead' | 'admin')}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="employee">Employee</option>
              <option value="lead">Lead</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <Button type="submit" disabled={isSubmitting || !selected}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add to project
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
