import { Card, CardContent } from '@/components/ui/card';

export function DashboardAdminOverviewFallback() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-xl border border-border bg-muted/30" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
