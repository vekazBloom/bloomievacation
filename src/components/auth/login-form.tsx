'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { markInvitationSyncCompleted } from '@/lib/invitations/session-sync';
import { sanitizeInternalRedirectPath } from '@/lib/security/redirect';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setIsLoading(false);

    if (error) {
      toast.error(error.message || 'Failed to sign in');
      return;
    }

    toast.success('Welcome back!');

    const nextPath = sanitizeInternalRedirectPath(redirectTo);
    if (nextPath.startsWith('/api/invitations/accept')) {
      window.location.href = nextPath;
      return;
    }

    await fetch('/api/invitations/sync', { method: 'POST' });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      markInvitationSyncCompleted(user.id);
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          {...register('email')}
          disabled={isLoading}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register('password')}
          disabled={isLoading}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? <Loader2 className="animate-spin" /> : null}
        {isLoading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
