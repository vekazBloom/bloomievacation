'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { projectPath } from '@/lib/projects/paths';

const schema = z.object({
  name: z.string().min(2, 'Project name is too short').max(80),
  description: z.string().max(500).optional(),
  vacation_threshold_percent: z.coerce.number().int().min(1).max(100),
  year_reset_month: z.coerce.number().int().min(1).max(12),
  year_reset_day: z.coerce.number().int().min(1).max(31),
  annual_accrual_month: z.coerce.number().int().min(1).max(12),
  annual_accrual_day: z.coerce.number().int().min(1).max(31),
  carry_over_policy: z.enum(['ask', 'auto_transfer', 'auto_lose']),
});

type FormValues = z.infer<typeof schema>;

export function NewProjectForm() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vacation_threshold_percent: 50,
      year_reset_month: 1,
      year_reset_day: 1,
      annual_accrual_month: 1,
      annual_accrual_day: 1,
      carry_over_policy: 'ask',
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be smaller than 2MB');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not authenticated');
      setIsLoading(false);
      return;
    }

    // 1. Create project row.
    const insertPayload = {
      name: values.name,
      description: values.description || null,
      vacation_threshold_percent: values.vacation_threshold_percent,
      year_reset_month: values.year_reset_month,
      year_reset_day: values.year_reset_day,
      annual_accrual_month: values.annual_accrual_month,
      annual_accrual_day: values.annual_accrual_day,
      carry_over_policy: values.carry_over_policy,
      created_by: user.id,
    };

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .insert(insertPayload)
      .select('id, slug')
      .single();

    let projectId = project?.id ?? null;
    let projectSlug = project?.slug ?? null;

    if (projectErr?.code === '42703' && projectErr.message.includes('projects.slug')) {
      const { data: fallbackProject, error: fallbackErr } = await supabase
        .from('projects')
        .insert(insertPayload)
        .select('id')
        .single();

      if (fallbackErr || !fallbackProject) {
        toast.error(fallbackErr?.message || 'Failed to create project');
        setIsLoading(false);
        return;
      }

      projectId = fallbackProject.id;
      projectSlug = null;
      toast.warning('Project created, but DB slug migration is missing. Run migration 005_project_slugs.sql.');
    } else if (projectErr || !projectId) {
      toast.error(projectErr?.message || 'Failed to create project');
      setIsLoading(false);
      return;
    }

    // 2. Upload logo if provided.
    let logoUrl: string | null = null;
    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const path = `${projectId}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('project-logos')
        .upload(path, logoFile, { upsert: true });

      if (!uploadErr) {
        const { data: pub } = supabase.storage.from('project-logos').getPublicUrl(path);
        logoUrl = pub.publicUrl;
        await supabase.from('projects').update({ logo_url: logoUrl }).eq('id', projectId);
      } else {
        console.error('Logo upload failed:', uploadErr);
      }
    }

    // 3. Add creator as project admin.
    const { error: memberErr } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: user.id,
      role: 'admin',
    });
    if (memberErr) console.error('Member insert error:', memberErr);

    setIsLoading(false);
    toast.success(`Project "${values.name}" created`);
    router.push(projectSlug ? projectPath(projectSlug) : '/projects');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <h2 className="font-display text-lg">Basics</h2>

          <div className="space-y-2">
            <Label htmlFor="logo">Project logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted">
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <input
                  id="logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Label
                  htmlFor="logo"
                  className="inline-flex cursor-pointer items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  Choose image
                </Label>
                {logoFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                    className="ml-2 inline-flex items-center text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                    Remove
                  </button>
                )}
                <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP. Max 2MB.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Project name *</Label>
            <Input id="name" placeholder="e.g. Bloomteq Engineering" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Optional short description"
              {...register('description')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <h2 className="font-display text-lg">Policies</h2>
            <p className="text-sm text-muted-foreground">
              You can change these later in project settings.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vacation_threshold_percent">
              Overlap warning threshold (% of team)
            </Label>
            <Input
              id="vacation_threshold_percent"
              type="number"
              min={1}
              max={100}
              {...register('vacation_threshold_percent')}
            />
            <p className="text-xs text-muted-foreground">
              When more than this % of the team already has approved annual leave on the same
              dates, the requester sees a warning.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="annual_accrual_month">Annual accrual — month</Label>
              <Input
                id="annual_accrual_month"
                type="number"
                min={1}
                max={12}
                {...register('annual_accrual_month')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual_accrual_day">Annual accrual — day</Label>
              <Input
                id="annual_accrual_day"
                type="number"
                min={1}
                max={31}
                {...register('annual_accrual_day')}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Date when each year&apos;s new annual fund opens (used by the year-reset job). Defaults to 1
            January; you can change it later in settings (including optional use-by date).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year_reset_month">Year reset — month</Label>
              <Input
                id="year_reset_month"
                type="number"
                min={1}
                max={12}
                {...register('year_reset_month')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year_reset_day">Year reset — day</Label>
              <Input
                id="year_reset_day"
                type="number"
                min={1}
                max={31}
                {...register('year_reset_day')}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Annual balances reset on this date each year.
          </p>

          <div className="space-y-2">
            <Label htmlFor="carry_over_policy">Carry-over policy</Label>
            <select
              id="carry_over_policy"
              {...register('carry_over_policy')}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ask">Ask each member at year-end</option>
              <option value="auto_transfer">Auto-transfer unused days</option>
              <option value="auto_lose">Auto-clear unused days</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.push('/projects')}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="animate-spin" />}
          {isLoading ? 'Creating…' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}
