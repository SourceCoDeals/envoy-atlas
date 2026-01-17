import { cn } from '@/lib/utils';
import { LucideIcon, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

type InsightVariant = 'info' | 'success' | 'warning' | 'error';

interface InsightBoxProps {
  title?: string;
  message: string;
  variant?: InsightVariant;
  icon?: LucideIcon;
  className?: string;
}

const variantConfig: Record<InsightVariant, { 
  bg: string; 
  border: string; 
  text: string; 
  icon: LucideIcon 
}> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    icon: Info,
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
    icon: CheckCircle,
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-300',
    icon: AlertTriangle,
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    icon: AlertCircle,
  },
};

export function InsightBox({
  title,
  message,
  variant = 'info',
  icon,
  className,
}: InsightBoxProps) {
  const config = variantConfig[variant];
  const Icon = icon || config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        config.bg,
        config.border,
        className
      )}
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.text)} />
      <div className="flex-1 min-w-0">
        {title && (
          <p className={cn('font-medium', config.text)}>{title}</p>
        )}
        <p className={cn('text-sm', title ? 'mt-1' : '', config.text)}>
          {message}
        </p>
      </div>
    </div>
  );
}
