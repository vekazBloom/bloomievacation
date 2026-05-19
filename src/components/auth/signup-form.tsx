'use client';

import { useState } from 'react';
import Link from 'next/link';
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

function inviteAcceptPath(token: string) {
  return `/api/invitations/accept?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent('/dashboard')}`;
}

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

    const signupRes = await fetch('/api/auth/invite-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: inviteToken,
        email: normalizedEmail,
        password: values.password,
        name: values.name,
      }),
    });

    const signupBody = await signupRes.json().catch(() => ({}));

    if (!signupRes.ok) {
      setIsLoading(false);
      if (signupRes.status === 409) {
        toast.error(signupBody.error || 'Account already exists. Sign in instead.');
        router.push(
          `/login?redirectTo=${encodeURIComponent(inviteAcceptPath(inviteToken))}&email=${encodeURIComponent(normalizedEmail)}`
        );
        return;
      }
      toast.error(signupBody.error || 'Failed to create account');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: values.password,
    });

    if (signInError) {
      setIsLoading(false);
      toast.error(signInError.message || 'Account created but sign-in failed. Try signing in.');
      router.push(
        `/login?redirectTo=${encodeURIComponent(inviteAcceptPath(inviteToken))}&email=${encodeURIComponent(normalizedEmail)}`
      );
      return;
    }

    const acceptRes = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inviteToken }),
    });
    const acceptBody = await acceptRes.json().catch(() => ({}));

    if (!acceptRes.ok) {
      setIsLoading(false);
      toast.error(acceptBody.error || 'Failed to accept invitation');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      markInvitationSyncCompleted(user.id);
    }

    toast.success('Account created! You are all set.');
    window.location.href = '/dashboard';
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
