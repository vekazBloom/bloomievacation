import type { AnnualAllocationInput } from '@/lib/leave/entitlement-grants';

export type ExistingAllocationRow = {
  grant_id?: string | null;
  working_days?: number | string | null;
};

export type ResolveDateEditAllocationsResult =
  | { ok: true; allocations: AnnualAllocationInput[] }
  | { ok: false; error: string };

/** Matches the tolerance the create and approve paths already use for fund day splits. */
const DAY_EPSILON = 0.02;

export function existingAllocationInputs(rows: ExistingAllocationRow[]): AnnualAllocationInput[] {
  return rows
    .filter((row): row is ExistingAllocationRow & { grant_id: string } => Boolean(row.grant_id))
    .map((row) => ({ grantId: row.grant_id, workingDays: Number(row.working_days || 0) }));
}

/**
 * Works out which annual funds an edited request should draw from once its dates — and therefore its
 * working day count — have changed. Rewriting these rows is what returns days to the employee when a
 * request shrinks and consumes more when it grows, because fund usage is derived from them.
 */
export function resolveDateEditAllocations(params: {
  workingDays: number;
  existing: ExistingAllocationRow[];
  explicit?: AnnualAllocationInput[];
}): ResolveDateEditAllocationsResult {
  const { workingDays, explicit } = params;

  if (!Number.isFinite(workingDays) || workingDays <= 0) {
    return {
      ok: false,
      error: 'These dates contain no working days. Pick a range with at least one working day.',
    };
  }

  if (explicit?.length) {
    if (explicit.some((row) => !Number.isFinite(row.workingDays) || row.workingDays <= 0)) {
      return { ok: false, error: 'Each fund allocation must be greater than zero.' };
    }
    const sum = explicit.reduce((total, row) => total + row.workingDays, 0);
    if (Math.abs(sum - workingDays) > DAY_EPSILON) {
      return {
        ok: false,
        error: `Fund day split must equal the request working days (${workingDays}). Currently ${sum}.`,
      };
    }
    return { ok: true, allocations: explicit };
  }

  const current = existingAllocationInputs(params.existing);

  /** No grants back this request — the scalar balance counters cover it instead. */
  if (current.length === 0) return { ok: true, allocations: [] };

  if (current.length > 1) {
    return {
      ok: false,
      error:
        'This request is split across multiple annual funds. Set how many days to take from each fund before saving the new dates.',
    };
  }

  return { ok: true, allocations: [{ grantId: current[0].grantId, workingDays }] };
}

/** True when the edit moves days onto a different set of funds, which only a system admin may do. */
export function allocationsChangeGrantSet(
  existing: ExistingAllocationRow[],
  next: AnnualAllocationInput[]
): boolean {
  const before = new Set(existingAllocationInputs(existing).map((row) => row.grantId));
  const after = new Set(next.map((row) => row.grantId));
  if (before.size !== after.size) return true;
  for (const grantId of after) {
    if (!before.has(grantId)) return true;
  }
  return false;
}
