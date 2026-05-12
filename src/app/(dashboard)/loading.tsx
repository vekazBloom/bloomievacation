export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-2">
      <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted/70" />
    </div>
  );
}
