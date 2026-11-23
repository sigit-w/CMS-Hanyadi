import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-background text-foreground',
  destructive: 'border-destructive/50 text-destructive bg-red-50',
  success: 'border-green-200 text-green-800 bg-green-50'
};

export function Alert({ className, variant = 'default', ...props }) {
  return <div role="alert" className={cn('relative w-full rounded-lg border p-4 text-sm', variants[variant] || variants.default, className)} {...props} />;
}
