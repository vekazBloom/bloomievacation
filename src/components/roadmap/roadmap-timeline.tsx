'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, User, Link2, GripVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  computeRoadmapMonths,
  monthSpanLength,
  type RoadmapMonth,
} from '@/lib/roadmap/months';
import {
  STATUS_LABELS,
  STATUS_ORDER,
  customChipStyle,
  statusChipClasses,
} from '@/lib/roadmap/status-theme';
import type { RoadmapData, RoadmapItem, RoadmapTeamWithMembers } from '@/lib/read/roadmap';
import { RoadmapItemDialog } from '@/components/roadmap/roadmap-item-dialog';

const LABEL_W = 190;
const MIN_COL = 104;
// Row pitch per stacked feature. Boxes leave a vertical gap inside this pitch so a
// dependency connector between stacked rows has clear space to be seen.
const ROW_H = 66;

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

  async function deleteItem(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Remove this feature from the roadmap?')) {
      return;
    }
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/roadmap/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Could not remove the feature');
      }
      toast.success('Feature removed');
    } catch (err) {
      setItems(prev);
      toast.error(err instanceof Error ? err.message : 'Could not remove the feature');
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
              onDeleteItem={deleteItem}
              onAddToTeam={(teamId) => setDialog({ open: true, mode: 'create', defaultTeamId: teamId })}
            />
          ))}
        </div>
      </div>

      <Backlog
        teams={initial.teams}
        itemsByTeam={itemsByTeam}
        onEditItem={(item) => setDialog({ open: true, mode: 'edit', item })}
        onDeleteItem={deleteItem}
        onAddToTeam={(teamId) => setDialog({ open: true, mode: 'create', defaultTeamId: teamId })}
      />

      {dialog.open ? (
        <RoadmapItemDialog
          key={dialog.mode === 'edit' ? dialog.item.id : 'create'}
          mode={dialog.mode}
          teams={initial.teams}
          months={months}
          allItems={items}
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
  onDeleteItem,
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
  onDeleteItem: (id: string) => void;
  onAddToTeam: (teamId: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const scheduled = items.filter((i) => i.start_month && i.end_month);
  const { rowById, rowCount } = assignRows(scheduled, idxOf);
  const trackHeight = rowCount * ROW_H + 8;
  const isSpecial = team.kind !== 'engineering';

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    setTrackW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setTrackW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Geometry per scheduled item (start/end column + row), honoring the live drag.
  const geom = scheduled.map((item) => {
    const dragged = drag && drag.id === item.id ? drag : null;
    return {
      item,
      startIdx: dragged ? dragged.startIdx : idxOf(item.start_month),
      endIdx: dragged ? dragged.endIdx : idxOf(item.end_month),
      row: rowById.get(item.id) ?? 0,
    };
  });
  const geomById = new Map(geom.map((g) => [g.item.id, g]));

  const colW = months.length > 0 ? trackW / months.length : 0;
  // Dependency connectors: prerequisite → dependent, both scheduled in this team.
  const connectors =
    colW > 0
      ? geom
          .filter((g) => g.item.depends_on_id && geomById.has(g.item.depends_on_id))
          .map((target) => {
            const source = geomById.get(target.item.depends_on_id!)!;
            const x1 = (source.endIdx + 1) * colW - 4;
            const y1 = source.row * ROW_H + ROW_H / 2;
            const x2 = target.startIdx * colW + 6;
            const y2 = target.row * ROW_H + ROW_H / 2;
            const midX = (x1 + x2) / 2;
            return {
              id: target.item.id,
              d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
            };
          })
      : [];

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
        {connectors.length > 0 ? (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            style={{ gridColumn: `1 / span ${months.length}`, gridRow: `1 / span ${rowCount}` }}
            aria-hidden
          >
            <defs>
              <marker
                id={`rm-arrow-${team.id}`}
                markerWidth="7"
                markerHeight="7"
                refX="5.5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="hsl(var(--foreground))" />
              </marker>
            </defs>
            {connectors.map((c) => (
              <path
                key={c.id}
                d={c.d}
                fill="none"
                stroke="hsl(var(--foreground))"
                strokeOpacity={0.55}
                strokeWidth={2}
                markerEnd={`url(#rm-arrow-${team.id})`}
              />
            ))}
          </svg>
        ) : null}
        {geom.map(({ item, startIdx, endIdx, row }) => {
          const spanMonths = monthSpanLength(item.start_month!, item.end_month!) + 1;
          const custom = item.color ? customChipStyle(item.color) : null;
          const dragged = drag?.id === item.id;
          return (
            <div
              key={item.id}
              className={cn(
                'group relative mx-1 my-2.5 flex cursor-grab flex-col justify-center overflow-hidden rounded-lg border px-2 py-1 text-xs select-none',
                custom ? 'border' : statusChipClasses(item.status),
                dragged && 'ring-2 ring-ring'
              )}
              style={{
                gridColumn: `${startIdx + 1} / ${endIdx + 2}`,
                gridRow: row + 1,
                ...(custom ?? {}),
              }}
              onPointerDown={(e) => onBeginDrag(e, item, 'move', trackRef.current)}
              title={item.dependencies ? `Depends on: ${item.dependencies}` : undefined}
            >
              <div className="flex items-center gap-1 font-medium leading-tight">
                <span className="truncate">{item.title}</span>
                {item.dependencies ? <Link2 className="h-3 w-3 shrink-0" /> : null}
                <button
                  type="button"
                  className="relative z-10 ml-auto mr-1 hidden shrink-0 rounded p-0.5 opacity-70 hover:bg-black/10 hover:opacity-100 group-hover:block"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                  }}
                  aria-label={`Remove ${item.title}`}
                >
                  <X className="h-3 w-3" />
                </button>
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

function Backlog({
  teams,
  itemsByTeam,
  onEditItem,
  onDeleteItem,
  onAddToTeam,
}: {
  teams: RoadmapTeamWithMembers[];
  itemsByTeam: Map<string, RoadmapItem[]>;
  onEditItem: (item: RoadmapItem) => void;
  onDeleteItem: (id: string) => void;
  onAddToTeam: (teamId: string) => void;
}) {
  const rows = teams
    .map((team) => ({
      team,
      unscheduled: (itemsByTeam.get(team.id) ?? []).filter(
        (i) => !i.start_month || !i.end_month
      ),
    }))
    .filter((r) => r.unscheduled.length > 0);

  if (rows.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
        <h2 className="font-display text-lg">Unscheduled backlog</h2>
        <span className="text-xs text-muted-foreground">
          Features without a month — click to schedule, × to remove.
        </span>
      </div>
      <div className="divide-y divide-border">
        {rows.map(({ team, unscheduled }) => (
          <div key={team.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <div
              className="flex w-40 shrink-0 items-center gap-2 pl-2"
              style={{ borderLeft: `3px solid ${team.color}` }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: team.color }}
                aria-hidden
              />
              <span className="truncate text-sm font-medium">{team.name}</span>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {unscheduled.map((item) => {
                const custom = item.color ? customChipStyle(item.color) : null;
                return (
                  <span
                    key={item.id}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
                      custom ? 'border' : statusChipClasses(item.status)
                    )}
                    style={custom ?? undefined}
                  >
                    <button
                      type="button"
                      onClick={() => onEditItem(item)}
                      title={`${item.title} — click to schedule`}
                      className="max-w-[240px] truncate font-medium"
                    >
                      {item.title}
                    </button>
                    {item.owner ? <span className="opacity-80">· {item.owner}</span> : null}
                    {item.dependencies ? <Link2 className="h-3 w-3 shrink-0" /> : null}
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      aria-label={`Remove ${item.title}`}
                      className="ml-0.5 rounded p-0.5 opacity-70 hover:bg-black/10 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => onAddToTeam(team.id)}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
