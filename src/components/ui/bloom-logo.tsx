import Image from 'next/image';
import { cn } from '@/lib/utils';

const WORDMARK_ASPECT_RATIO = 1024 / 682;

export function BloomLogo({
  className,
  size = 32,
  showText = true,
}: {
  className?: string;
  size?: number;
  showText?: boolean;
}) {
  if (showText) {
    const height = size;
    const width = Math.round(height * WORDMARK_ASPECT_RATIO);

    return (
      <div className={cn('flex items-center', className)}>
        <Image
          src="/brand/bloomivacation-wordmark.png"
          alt="BloomieVacation"
          width={width}
          height={height}
          className="h-auto w-auto max-w-[220px]"
          priority
        />
      </div>
    );
  }

  return (
    <Image
      src="/brand/bloomivacation-mark.png"
      alt="BloomieVacation"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
    />
  );
}
