'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { projectPath } from '@/lib/projects/paths';

export function LeaveRequestForm({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [type, setType] = useState<'annual' | 'sick'>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ workingDays: number; exceedsThreshold: boolean; overlappingMembers: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) {
      setPreview(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      const response = await fetch(
        `/api/leave-requests/preview?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}`
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setPreview({
        workingDays: payload.workingDays,
        exceedsThreshold: payload.overlap?.exceedsThreshold,
        overlappingMembers: payload.overlap?.overlappingMembers,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [projectId, startDate, endDate]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    let attachmentUrl: string | null = null;
    if (attachmentFile) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsSubmitting(false);
        return toast.error('You must be signed in to upload an attachment');
      }

      const path = `${user.id}/${Date.now()}-${attachmentFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('sick-leave-attachments')
        .upload(path, attachmentFile);
      if (uploadError) {
        setIsSubmitting(false);
        return toast.error(uploadError.message);
      }
      attachmentUrl = path;
    }

    const response = await fetch('/api/leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        type,
        startDate,
        endDate,
        reason: reason || null,
        attachmentUrl,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!response.ok) return toast.error(payload.error || 'Failed to submit request');
    toast.success('Leave request submitted');
    router.push(projectPath(projectSlug, 'requests'));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="leave-type">Leave type</Label>
        <select
          id="leave-type"
          value={type}
          onChange={(event) => setType(event.target.value as 'annual' | 'sick')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="annual">Annual leave</option>
          <option value="sick">Sick leave</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start date</Label>
          <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">End date</Label>
          <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      {type === 'sick' ? (
        <div className="space-y-2">
          <Label htmlFor="attachment">Doctor&apos;s note (optional)</Label>
          <Input
            id="attachment"
            type="file"
            accept="image/*,.pdf"
            onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
          />
        </div>
      ) : null}

      {preview ? (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          <p>Working days: {preview.workingDays}</p>
          {preview.exceedsThreshold ? (
            <p className="text-amber-700">
              Warning: {preview.overlappingMembers} colleagues already have approved annual leave in this period.
            </p>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        Submit request
      </Button>
    </form>
  );
}
