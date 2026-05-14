/** Label for a fund’s validity vs an anchor calendar day (YYYY-MM-DD), e.g. leave start. */
export type FundPeriodLabel = 'Active' | 'Past' | 'Future';

export function fundPeriodLabelForAnchor(
  anchorIso: string,
  validFrom: string,
  validTo: string | null
): FundPeriodLabel {
  if (anchorIso < validFrom) return 'Future';
  if (validTo && anchorIso > validTo) return 'Past';
  return 'Active';
}

export function fundSourceShortLabel(source: string): string {
  if (source === 'legacy_migration') return 'Legacy';
  if (source === 'grant') return 'Year grant';
  if (source === 'carryover') return 'Carryover';
  return 'Fund';
}
