import type { CSSProperties } from 'react';
import type { RoadmapItemStatus } from '@/types/database';

/**
 * Status → chip colors. Mirrors the palette of the shared `Badge` variants
 * (success/pending/warning + a neutral gray) so the roadmap reads consistently
 * with the rest of the app: green = done, blue = in progress, orange = waiting,
 * gray = planned. Team identity is carried by the swimlane color, never the chip.
 */
export function statusChipClasses(status: RoadmapItemStatus): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-100 text-emerald-900';
    case 'in_progress':
      return 'border-blue-200 bg-blue-100 text-blue-900';
    case 'waiting':
      return 'border-amber-200 bg-amber-100 text-amber-900';
    case 'planned':
    default:
      return 'border-border bg-muted text-foreground';
  }
}

export const STATUS_LABELS: Record<RoadmapItemStatus, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  waiting: 'Waiting',
  planned: 'Planned',
};

/** Order used for the legend and the status <select>. */
export const STATUS_ORDER: RoadmapItemStatus[] = [
  'completed',
  'in_progress',
  'waiting',
  'planned',
];

/**
 * Preset chip colors offered in the edit modal. All are dark enough to read
 * white text, so a custom-colored chip renders as a solid swatch with white text
 * (distinct from the pale status chips). Stored on the item as `color` (#RRGGBB).
 */
export const CHIP_COLORS: Array<{ hex: string; name: string }> = [
  { hex: '#6D28D9', name: 'Violet' },
  { hex: '#1D4ED8', name: 'Blue' },
  { hex: '#0F766E', name: 'Teal' },
  { hex: '#047857', name: 'Green' },
  { hex: '#B45309', name: 'Amber' },
  { hex: '#C2410C', name: 'Orange' },
  { hex: '#BE123C', name: 'Rose' },
  { hex: '#475569', name: 'Slate' },
];

/** Inline style for a chip with a custom color override (solid fill, white text). */
export function customChipStyle(hex: string): CSSProperties {
  return { backgroundColor: hex, borderColor: hex, color: '#ffffff' };
}
