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

function emailConfirmRedirectUrl(token: string) {
  const next = inviteAcceptPath(token);
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
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
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

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
    setAwaitingEmailConfirm(false);

    const normalizedEmail = values.email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: values.password,
      options: {
        data: { name: values.name },
        emailRedirectTo: emailConfirmRedirectUrl(inviteToken),
      },
    });

    if (error) {
      const msg = error.message || 'Failed to create account';
      if (msg.toLowerCase().includes('already registered')) {
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: normalizedEmail,
          options: {
            emailRedirectTo: emailConfirmRedirectUrl(inviteToken),
          },
        });

        if (!resendError) {
          setAwaitingEmailConfirm(true);
          setPendingEmail(normalizedEmail);
          toast.success('Check your email to confirm your account.');
          setIsLoading(false);
          return;
        }

        toast.error('This email already has an account. Sign in to accept the invite.');
        router.push(
          `/login?redirectTo=${encodeURIComponent(inviteAcceptPath(inviteToken))}&email=${encodeURIComponent(normalizedEmail)}`
        );
      } else {
        toast.error(msg);
      }
      setIsLoading(false);
      return;
    }

    if (data.user) {
      const profileRes = await fetch('/api/auth/invite-signup-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user.id,
          email: normalizedEmail,
          name: values.name,
        }),
      });
      if (!profileRes.ok) {
        const body = await profileRes.json().catch(() => ({}));
        console.error('Profile creation error:', body.error);
      }
    }

    if (inviteToken && data.session) {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setIsLoading(false);
        toast.error(payload.error || 'Failed to accept invitation');
        return;
      }

      toast.success('Account created! You are all set.');
      if (data.user?.id) {
        markInvitationSyncCompleted(data.user.id);
      }
      window.location.href = '/dashboard';
      return;
    }

    setIsLoading(false);
    setAwaitingEmailConfirm(true);
    setPendingEmail(normalizedEmail);
    toast.success('Check your email to confirm your account.');
  }

  if (awaitingEmailConfirm && pendingEmail) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-5">
        <h2 className="font-medium text-foreground">Confirm your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong>{pendingEmail}</strong>. Open it to finish setup
          and accept your invitation automatically.
        </p>
        <p className="text-xs text-muted-foreground">
          After confirming, you will be signed in and added to the team. If you do not see the email,
          check spam or ask your admin to verify Supabase email settings.
        </p>
        {inviteToken ? (
          <Button asChild variant="outline" className="w-full">
            <Link href={`/login?redirectTo=${encodeURIComponent(inviteAcceptPath(inviteToken))}&email=${encodeURIComponent(pendingEmail)}`}>
              Already confirmed? Sign in
            </Link>
          </Button>
        ) : null}
      </div>
    );
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
