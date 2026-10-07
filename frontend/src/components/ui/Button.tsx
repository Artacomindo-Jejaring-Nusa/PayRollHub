import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-body-semibold transition-all duration-150 rounded-lg outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.99]';

  const variants = {
    primary: 'bg-primary-container hover:bg-accent-hover text-on-primary shadow-sm focus:ring-primary',
    secondary: 'bg-secondary-container hover:bg-secondary-fixed text-on-background focus:ring-secondary',
    outline: 'border border-border-subtle bg-surface-panel hover:bg-surface-container-low text-text-primary focus:ring-primary',
    danger: 'bg-error hover:bg-red-700 text-on-primary focus:ring-error',
    ghost: 'hover:bg-surface-container text-text-primary focus:ring-primary',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500',
  };

  const sizes = {
    sm: 'h-8 px-3 text-[12px] gap-1.5',
    md: 'h-10 px-4 text-[14px] gap-2',
    lg: 'h-11 px-5 text-[15px] gap-2.5',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};
