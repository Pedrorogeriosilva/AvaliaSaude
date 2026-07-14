import Image from 'next/image';
import clsx from 'clsx';

type Props = {
  className?: string;
  priority?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'horizontal' | 'symbol';
};

const sizeMap = {
  horizontal: {
    sm: { width: 150, height: 71 },
    md: { width: 220, height: 104 },
    lg: { width: 300, height: 142 },
  },
  symbol: {
    sm: { width: 36, height: 36 },
    md: { width: 48, height: 48 },
    lg: { width: 72, height: 72 },
  },
} as const;

export function SiteLogo({ className, priority = false, size = 'md', variant = 'horizontal' }: Props) {
  const dimensions = sizeMap[variant][size];
  const src = variant === 'horizontal' ? '/brand/logo-avalia-saude-horizontal.webp' : '/brand/logo-avalia-saude-simbolo.png';

  return (
    <Image
      src={src}
      alt="Avalia Saúde"
      width={dimensions.width}
      height={dimensions.height}
      priority={priority}
      className={clsx('h-auto max-w-full object-contain', className)}
    />
  );
}
