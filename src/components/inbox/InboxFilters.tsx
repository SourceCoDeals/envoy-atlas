import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Flame, AlertCircle, Clock, User } from 'lucide-react';
import type { PriorityLevel } from '@/lib/replyClassification';

interface FilterCounts {
  hot: number;
  high: number;
  medium: number;
  low: number;
  overdue: number;
  dueSoon: number;
  unassigned: number;
}

interface InboxFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  priorityFilter: PriorityLevel | 'all';
  onPriorityFilterChange: (value: PriorityLevel | 'all') => void;
  sortBy: 'priority' | 'time';
  onSortChange: (value: 'priority' | 'time') => void;
  counts: FilterCounts;
  quickFilter: 'overdue' | 'due_soon' | 'unassigned' | null;
  onQuickFilterChange: (filter: 'overdue' | 'due_soon' | 'unassigned' | null) => void;
}

export function InboxFilters({
  searchQuery,
  onSearchChange,
  priorityFilter,
  onPriorityFilterChange,
  sortBy,
  onSortChange,
  counts,
  quickFilter,
  onQuickFilterChange,
}: InboxFiltersProps) {
  const priorityButtons = [
    { value: 'P0' as const, label: '🔴 Hot', count: counts.hot, color: 'text-red-500' },
    { value: 'P1' as const, label: '🟠 High', count: counts.high, color: 'text-orange-500' },
    { value: 'P2' as const, label: '🟡 Medium', count: counts.medium, color: 'text-yellow-500' },
    { value: 'P3' as const, label: '🔵 Low', count: counts.low, color: 'text-blue-500' },
  ];

  return (
    <div className="space-y-3">
      {/* Priority Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={priorityFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPriorityFilterChange('all')}
        >
          All ({counts.hot + counts.high + counts.medium + counts.low})
        </Button>
        {priorityButtons.map(btn => (
          <Button
            key={btn.value}
            variant={priorityFilter === btn.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPriorityFilterChange(btn.value)}
            className={priorityFilter !== btn.value ? btn.color : ''}
          >
            {btn.label} ({btn.count})
          </Button>
        ))}
        <Button
          variant={priorityFilter === 'P4' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPriorityFilterChange('P4')}
          className="text-muted-foreground"
        >
          ⚪ Archive
        </Button>
      </div>

      {/* Search and Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search replies..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => onSortChange(v as 'priority' | 'time')}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="time">Most Recent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Quick Filters:</span>
        <Button
          variant={quickFilter === 'overdue' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7"
          onClick={() => onQuickFilterChange(quickFilter === 'overdue' ? null : 'overdue')}
        >
          <AlertCircle className="h-3 w-3 mr-1 text-destructive" />
          Overdue ({counts.overdue})
        </Button>
        <Button
          variant={quickFilter === 'due_soon' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7"
          onClick={() => onQuickFilterChange(quickFilter === 'due_soon' ? null : 'due_soon')}
        >
          <Clock className="h-3 w-3 mr-1 text-warning" />
          Due Soon ({counts.dueSoon})
        </Button>
        <Button
          variant={quickFilter === 'unassigned' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7"
          onClick={() => onQuickFilterChange(quickFilter === 'unassigned' ? null : 'unassigned')}
        >
          <User className="h-3 w-3 mr-1" />
          Unassigned ({counts.unassigned})
        </Button>
      </div>
    </div>
  );
}
