import { BloomLogo } from '@/components/ui/bloom-logo';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain-bg relative min-h-screen overflow-hidden bg-background">
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, hsl(340 80% 75%), transparent)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, hsl(40 90% 70%), transparent)' }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-6 py-6 sm:px-10">
          <Link href="/" aria-label="BloomieVacation home">
            <BloomLogo size={40} />
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[420px] animate-fade-in">{children}</div>
        </main>

        <footer className="px-6 py-6 text-center text-xs text-muted-foreground sm:px-10">
          <p>
            Made with <span className="text-primary">♥</span> for teams that care about rest.
          </p>
        </footer>
      </div>
    </div>
  );
}
