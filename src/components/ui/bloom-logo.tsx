'use client';

import { cn } from '@/lib/utils';

export function BloomLogo({
  className,
  size = 32,
  showText = true,
}: {
  className?: string;
  size?: number;
  showText?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="bloomGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="hsl(340 75% 60%)" />
            <stop offset="1" stopColor="hsl(340 75% 40%)" />
          </linearGradient>
        </defs>
        {/* Six petals arranged radially */}
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <ellipse
            key={angle}
            cx="20"
            cy="11"
            rx="4.5"
            ry="8"
            fill="url(#bloomGrad)"
            opacity="0.85"
            transform={`rotate(${angle} 20 20)`}
          />
        ))}
        <circle cx="20" cy="20" r="3.5" fill="hsl(40 90% 60%)" />
      </svg>
      {showText && (
        <span className="font-display text-xl font-medium tracking-tight">
          bloomie<span className="text-primary">vacation</span>
        </span>
      )}
    </div>
  );
}
