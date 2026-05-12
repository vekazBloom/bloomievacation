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

const schema = z.object({
  name: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
});

type FormValues = z.infer<typeof schema>;

export function SignupForm({
  prefilledEmail,
  inviteToken,
}: {
  prefilledEmail?: string;
  inviteToken?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: prefilledEmail || '' },
  });

  async function onSubmit(values: FormValues) {
    if (!inviteToken) {
      toast.error('You need a valid invitation to create an account.');
      return;
    }

    setIsLoading(true);

    const normalizedEmail = values.email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: values.password,
      options: {
        data: { name: values.name },
        emailRedirectTo: inviteToken
          ? `${window.location.origin}/invite?token=${encodeURIComponent(inviteToken)}`
          : `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      toast.error(error.message || 'Failed to create account');
      setIsLoading(false);
      return;
    }

    // Create the public.users row.
    if (data.user) {
      const { error: profileError } = await supabase.from('users').upsert({
        id: data.user.id,
        email: normalizedEmail,
        name: values.name,
      });
      if (profileError) console.error('Profile creation error:', profileError);

    }

    if (inviteToken) {
      if (!data.session) {
        setIsLoading(false);
        toast.success('Account created. Confirm your email, then open the invite link again.');
        router.push(`/invite?token=${encodeURIComponent(inviteToken)}`);
        return;
      }

      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setIsLoading(false);
        toast.error(payload.error || 'Failed to accept invitation');
        router.push(`/invite?token=${encodeURIComponent(inviteToken)}`);
        return;
      }

      toast.success('Account created! Joining your project…');
      if (data.user?.id) {
        markInvitationSyncCompleted(data.user.id);
      }
      window.location.href = '/dashboard';
      return;
    }

    setIsLoading(false);
    await fetch('/api/invitations/sync', { method: 'POST' });
    if (data.user?.id) {
      markInvitationSyncCompleted(data.user.id);
    }
    toast.success('Account created!');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Jane Doe"
          {...register('name')}
          disabled={isLoading}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          readOnly={!!prefilledEmail}
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          {...register('password')}
          disabled={isLoading}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? <Loader2 className="animate-spin" /> : null}
        {isLoading ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
