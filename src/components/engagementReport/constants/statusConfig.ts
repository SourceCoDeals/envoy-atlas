export type StatusType =
  | 'meeting'
  | 'hot'
  | 'conversation'
  | 'timing'
  | 'sequence'
  | 'closed'
  | 'interested'
  | 'not_interested'
  | 'active'
  | 'inactive'
  | 'completed'
  | 'pending';

export interface StatusConfigItem {
  label: string;
  icon?: string;
  colors: {
    bg: string;
    text: string;
    border: string;
  };
}

export const STATUS_CONFIG: Record<StatusType, StatusConfigItem> = {
  meeting: {
    label: 'Meeting Booked',
    icon: '📅',
    colors: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
    },
  },
  hot: {
    label: 'Hot Lead',
    icon: '🔥',
    colors: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-800 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-800',
    },
  },
  conversation: {
    label: 'In Conversation',
    icon: '💬',
    colors: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-800 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
    },
  },
  timing: {
    label: 'Future Timing',
    icon: '⏰',
    colors: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-800 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
    },
  },
  sequence: {
    label: 'In Sequence',
    icon: '📧',
    colors: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-800 dark:text-gray-300',
      border: 'border-gray-200 dark:border-gray-700',
    },
  },
  closed: {
    label: 'Closed',
    icon: '✖️',
    colors: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-800 dark:text-red-300',
      border: 'border-red-200 dark:border-red-800',
    },
  },
  interested: {
    label: 'Interested',
    icon: '👍',
    colors: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
    },
  },
  not_interested: {
    label: 'Not Interested',
    icon: '👎',
    colors: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-700',
    },
  },
  active: {
    label: 'Active',
    colors: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
    },
  },
  inactive: {
    label: 'Inactive',
    colors: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-700',
    },
  },
  completed: {
    label: 'Completed',
    icon: '✓',
    colors: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-300',
      border: 'border-green-200 dark:border-green-800',
    },
  },
  pending: {
    label: 'Pending',
    icon: '⏳',
    colors: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-300',
      border: 'border-yellow-200 dark:border-yellow-800',
    },
  },
};

export function getStatusConfig(status: string): StatusConfigItem | undefined {
  return STATUS_CONFIG[status as StatusType];
}

export function getHealthColor(score: number): string {
  if (score >= 70) return 'text-green-500';
  if (score >= 40) return 'text-yellow-500';
  return 'text-red-500';
}

export function getHealthLabel(score: number): string {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'Needs Attention';
  return 'Critical';
}
