import Image from 'next/image';
import { cn } from '@/lib/utils';

type RemoteImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
};

export function RemoteImage({ src, alt, width, height, className, sizes }: RemoteImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={cn(className)}
    />
  );
}
