'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function CarryOverPanel({
  projectId,
  year,
  remainingDays,
}: {
  projectId: string;
  year: number;
  remainingDays: number;
}) {
  const router = useRouter();

  async function decide(decision: 'transferred' | 'lost') {
    const response = await fetch('/api/carry-over', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, year, decision }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || 'Failed to save decision');
    toast.success(`Carry-over marked as ${decision}`);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
      <p className="font-medium text-amber-900">Year-end carry-over warning</p>
      <p className="mt-1 text-amber-800">
        You still have {remainingDays} annual day(s) remaining for {year}. Choose what should happen.
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={() => decide('transferred')}>
          Transfer
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => decide('lost')}>
          Lose remaining
        </Button>
      </div>
    </div>
  );
}
