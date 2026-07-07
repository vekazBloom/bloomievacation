'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus, User, Link2, GripVertical, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  computeRoadmapMonths,
  monthSpanLength,
  type RoadmapMonth,
} from '@/lib/roadmap/months';
import { STATUS_LABELS, STATUS_ORDER, statusChipClasses } from '@/lib/roadmap/status-theme';
import type { RoadmapData, RoadmapItem, RoadmapTeamWithMembers } from '@/lib/read/roadmap';
import { RoadmapItemDialog } from '@/components/roadmap/roadmap-item-dialog';

const LABEL_W = 190;
const MIN_COL = 104;
const ROW_H = 52;

type DragState = { id: string; startIdx: number; endIdx: number } | null;

type DialogState =
  | { open: false }
  | { open: true; mode: 'create'; defaultTeamId: string }
  | { open: true; mode: 'edit'; item: RoadmapItem };

function assignRows(items: RoadmapItem[], idxOf: (iso: string | null) => number) {
  const rowEnds: number[] = [];
  const rowById = new Map<string, number>();
  const sorted = [...items].sort((a, b) => idxOf(a.start_month) - idxOf(b.start_month));
  for (const item of sorted) {
    const start = idxOf(item.start_month);
    const end = idxOf(item.end_month);
    let row = rowEnds.findIndex((lastEnd) => lastEnd < start);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(end);
    } else {
      rowEnds[row] = end;
    }
    rowById.set(item.id, row);
  }
  return { rowById, rowCount: Math.max(1, rowEnds.length) };
}

export function RoadmapTimeline({ initial }: { initial: RoadmapData }) {
  const [items, setItems] = useState<RoadmapItem[]>(initial.items);
  const [drag, setDrag] = useState<DragState>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: false });

  const months = useMemo(() => computeRoadmapMonths(items), [items]);
  const idxByIso = useMemo(() => {
    const map = new Map<string, number>();
    months.forEach((m, i) => map.set(m.iso, i));
    return map;
  }, [months]);
  const idxOf = (iso: string | null) => (iso ? idxByIso.get(iso) ?? 0 : 0);

  const itemsByTeam = useMemo(() => {
    const map = new Map<string, RoadmapItem[]>();
    for (const item of items) {
      const list = map.get(item.team_id) ?? [];
      list.push(item);
      map.set(item.team_id, list);
    }
    return map;
  }, [items]);

  const gridCols = `${LABEL_W}px repeat(${months.length}, minmax(${MIN_COL}px, 1fr))`;
  const minWidth = LABEL_W + months.length * MIN_COL;

  async function patchItem(id: string, patch: Partial<RoadmapItem>) {
    const prev = items;
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try {
      const res = await fetch(`/api/roadmap/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Could not save the change');
      }
      const body = (await res.json()) as { item: RoadmapItem };
      setItems((cur) => cur.map((i) => (i.id === id ? body.item : i)));
    } catch (err) {
      setItems(prev);
      toast.error(err instanceof Error ? err.message : 'Could not save the change');
    }
  }

  function beginDrag(
    e: React.PointerEvent,
    item: RoadmapItem,
    mode: 'move' | 'resize-left' | 'resize-right',
    trackEl: HTMLDivElement | null
  ) {
    if (!trackEl || !item.start_month || !item.end_month) return;
    e.preventDefault();
    e.stopPropagation();
    const colW = trackEl.getBoundingClientRect().width / months.length;
    const originStart = idxOf(item.start_month);
    const originEnd = idxOf(item.end_month);
    const span = originEnd - originStart;
    const lastIdx = months.length - 1;
    const startX = e.clientX;
    let moved = false;
    let cur = { start: originStart, end: originEnd };

    const onMove = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / colW);
      if (delta !== 0) moved = true;
      let s = originStart;
      let en = originEnd;
      if (mode === 'move') {
        s = Math.min(Math.max(originStart + delta, 0), lastIdx - span);
        en = s + span;
      } else if (mode === 'resize-right') {
        en = Math.min(Math.max(originEnd + delta, originStart), lastIdx);
      } else {
        s = Math.min(Math.max(originStart + delta, 0), originEnd);
      }
      cur = { start: s, end: en };
      setDrag({ id: item.id, startIdx: s, endIdx: en });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDrag(null);
      if (!moved) {
        setDialog({ open: true, mode: 'edit', item });
        return;
      }
      const newStart = months[cur.start]?.iso ?? item.start_month;
      const newEnd = months[cur.end]?.iso ?? item.end_month;
      if (newStart !== item.start_month || newEnd !== item.end_month) {
        patchItem(item.id, { start_month: newStart, end_month: newEnd });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {STATUS_ORDER.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span
                className={cn('h-3 w-3 rounded-sm border', statusChipClasses(status))}
                aria-hidden
              />
              {STATUS_LABELS[status]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            has dependency
          </span>
        </div>
        <Button
          size="sm"
          onClick={() =>
            setDialog({
              open: true,
              mode: 'create',
              defaultTeamId: initial.teams[0]?.id ?? '',
            })
          }
        >
          <Plus className="h-4 w-4" />
          Add feature
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div style={{ minWidth }}>
          <div
            className="grid border-b border-border bg-muted/40"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {months[0]?.year ?? ''}
            </div>
            {months.map((m) => (
              <div
                key={m.key}
                className="border-l border-border px-1 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {m.label}
                {m.month === 1 ? <span className="ml-1 text-[10px]">{m.year}</span> : null}
              </div>
            ))}
          </div>

          {initial.teams.map((team) => (
            <SwimLane
              key={team.id}
              team={team}
              items={itemsByTeam.get(team.id) ?? []}
              months={months}
              gridCols={gridCols}
              idxOf={idxOf}
              drag={drag}
              onBeginDrag={beginDrag}
              onEditItem={(item) => setDialog({ open: true, mode: 'edit', item })}
              onAddToTeam={(teamId) => setDialog({ open: true, mode: 'create', defaultTeamId: teamId })}
            />
          ))}
        </div>
      </div>

      {dialog.open ? (
        <RoadmapItemDialog
          key={dialog.mode === 'edit' ? dialog.item.id : 'create'}
          mode={dialog.mode}
          teams={initial.teams}
          months={months}
          item={dialog.mode === 'edit' ? dialog.item : undefined}
          defaultTeamId={dialog.mode === 'create' ? dialog.defaultTeamId : undefined}
          onClose={() => setDialog({ open: false })}
          onSaved={(saved) => {
            setItems((cur) => {
              const exists = cur.some((i) => i.id === saved.id);
              return exists ? cur.map((i) => (i.id === saved.id ? saved : i)) : [...cur, saved];
            });
            setDialog({ open: false });
          }}
          onDeleted={(id) => {
            setItems((cur) => cur.filter((i) => i.id !== id));
            setDialog({ open: false });
          }}
        />
      ) : null}
    </div>
  );
}

function SwimLane({
  team,
  items,
  months,
  gridCols,
  idxOf,
  drag,
  onBeginDrag,
  onEditItem,
  onAddToTeam,
}: {
  team: RoadmapTeamWithMembers;
  items: RoadmapItem[];
  months: RoadmapMonth[];
  gridCols: string;
  idxOf: (iso: string | null) => number;
  drag: DragState;
  onBeginDrag: (
    e: React.PointerEvent,
    item: RoadmapItem,
    mode: 'move' | 'resize-left' | 'resize-right',
    trackEl: HTMLDivElement | null
  ) => void;
  onEditItem: (item: RoadmapItem) => void;
  onAddToTeam: (teamId: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scheduled = items.filter((i) => i.start_month && i.end_month);
  const unscheduled = items.filter((i) => !i.start_month || !i.end_month);
  const { rowById, rowCount } = assignRows(scheduled, idxOf);
  const trackHeight = rowCount * ROW_H + 8;
  const isSpecial = team.kind !== 'engineering';

  return (
    <div
      className={cn('grid border-b border-border last:border-b-0', isSpecial && 'bg-muted/30')}
      style={{ gridTemplateColumns: gridCols }}
    >
      <div
        className="flex flex-col justify-center gap-1 px-3 py-3"
        style={{ borderLeft: `3px solid ${team.color}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: team.color }}
            aria-hidden
          />
          <span className="text-sm font-medium">{team.name}</span>
          <button
            type="button"
            onClick={() => onAddToTeam(team.id)}
            className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`Add feature to ${team.name}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {team.members.length > 0 ? (
          <p className="pl-[18px] text-[11px] leading-tight text-muted-foreground">
            {team.members.map((m) => m.name).join(' · ')}
          </p>
        ) : null}
        {unscheduled.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1 pl-[18px]">
            {unscheduled.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onEditItem(item)}
                title={`${item.title} — click to schedule`}
                className={cn(
                  'inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px]',
                  statusChipClasses(item.status)
                )}
              >
                <span className="truncate">{item.title}</span>
                {item.dependencies ? <Link2 className="h-3 w-3 shrink-0" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        ref={trackRef}
        className="relative grid"
        style={{
          gridColumn: `2 / span ${months.length}`,
          gridTemplateColumns: `repeat(${months.length}, 1fr)`,
          gridAutoRows: `${ROW_H}px`,
          minHeight: trackHeight,
          backgroundImage:
            'repeating-linear-gradient(to right, transparent, transparent calc((100% / var(--cols)) - 0.5px), hsl(var(--border)) calc(100% / var(--cols)))',
          ['--cols' as string]: String(months.length),
        }}
      >
        {scheduled.map((item) => {
          const dragged = drag && drag.id === item.id ? drag : null;
          const startIdx = dragged ? dragged.startIdx : idxOf(item.start_month);
          const endIdx = dragged ? dragged.endIdx : idxOf(item.end_month);
          const row = rowById.get(item.id) ?? 0;
          const spanMonths = monthSpanLength(item.start_month!, item.end_month!) + 1;
          return (
            <div
              key={item.id}
              className={cn(
                'group relative m-1 flex cursor-grab flex-col justify-center overflow-hidden rounded-lg border px-2 py-1 text-xs select-none',
                statusChipClasses(item.status),
                dragged && 'ring-2 ring-ring'
              )}
              style={{ gridColumn: `${startIdx + 1} / ${endIdx + 2}`, gridRow: row + 1 }}
              onPointerDown={(e) => onBeginDrag(e, item, 'move', trackRef.current)}
              title={item.dependencies ? `Depends on: ${item.dependencies}` : undefined}
            >
              <div className="flex items-center gap-1 font-medium leading-tight">
                <span className="truncate">{item.title}</span>
                {item.dependencies ? <Link2 className="h-3 w-3 shrink-0" /> : null}
                <Pencil className="ml-auto hidden h-3 w-3 shrink-0 opacity-60 group-hover:block" />
              </div>
              {item.owner ? (
                <div className="flex items-center gap-1 truncate text-[11px] opacity-90">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{item.owner}</span>
                </div>
              ) : null}
              {spanMonths > 1 ? (
                <span
                  className="absolute inset-y-0 left-0 w-2 cursor-ew-resize"
                  onPointerDown={(e) => onBeginDrag(e, item, 'resize-left', trackRef.current)}
                  aria-hidden
                />
              ) : null}
              <span
                className="absolute inset-y-0 right-0 flex w-2 cursor-ew-resize items-center justify-center opacity-0 group-hover:opacity-60"
                onPointerDown={(e) => onBeginDrag(e, item, 'resize-right', trackRef.current)}
                aria-hidden
              >
                <GripVertical className="h-3 w-3" />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
