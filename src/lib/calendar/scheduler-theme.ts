export const schedulerTypeColors: Record<string, string> = {
  annual: 'bg-sky-500 text-white',
  sick: 'bg-amber-500 text-white',
  religious: 'bg-emerald-500 text-white',
  national: 'bg-slate-400 text-white',
};

export const schedulerTypeSoftColors: Record<string, string> = {
  annual: 'bg-sky-100 text-sky-900 border-sky-200',
  sick: 'bg-amber-100 text-amber-900 border-amber-200',
  religious: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  national: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function leaveChipClasses(
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | undefined,
  type: 'annual' | 'sick' | 'religious' | 'national'
) {
  if (type === 'national') {
    return 'border-slate-200 bg-slate-100 text-slate-700';
  }
  if (status === 'pending') {
    return 'border-amber-300 bg-amber-100 text-amber-950';
  }
  return 'border-emerald-300 bg-emerald-100 text-emerald-950';
}
