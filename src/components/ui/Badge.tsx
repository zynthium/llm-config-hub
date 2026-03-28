import { HTMLAttributes } from 'react';

type BadgeVariant = 'free' | 'paid' | 'tag' | 'default';

const variantStyles: Record<BadgeVariant, string> = {
  free: 'bg-green-100 text-green-700',
  paid: 'bg-purple-100 text-purple-700',
  tag: 'bg-gray-100 text-gray-600 border border-gray-200 rounded-full',
  default: 'bg-gray-100 text-gray-700',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'default', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
}
