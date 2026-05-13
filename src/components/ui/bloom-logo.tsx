import Image from 'next/image';
import { cn } from '@/lib/utils';

const WORDMARK_ASPECT_RATIO = 666 / 375;

export function BloomLogo({
  className,
  imageClassName,
  size = 32,
  showText = true,
}: {
  className?: string;
  /** Extra classes on the wordmark image (e.g. max width in a narrow sidebar). */
  imageClassName?: string;
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
          sizes="(max-width: 1024px) 240px, 280px"
          className={cn('h-auto w-auto max-w-full object-contain object-left', imageClassName)}
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
