export default function CalendarLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="h-[480px] animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
