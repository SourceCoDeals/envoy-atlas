import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Filter, CalendarIcon, X, RotateCcw } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from '@/hooks/useColdCallAnalytics';

export type DispositionFilter = 'all' | 'dm_only' | 'meetings_only' | 'connections';

export interface TopCallsFiltersState {
  dateRange: DateRange;
  customDateStart?: Date;
  customDateEnd?: Date;
  selectedReps: string[];
  disposition: DispositionFilter;
  minScore: number;
}

interface TopCallsFiltersProps {
  filters: TopCallsFiltersState;
  onFiltersChange: (filters: TopCallsFiltersState) => void;
  availableReps: string[];
  isLoading?: boolean;
}

const DATE_PRESETS = [
  { value: '7d', label: 'This Week' },
  { value: '14d', label: '2 Weeks' },
  { value: '30d', label: 'This Month' },
  { value: '90d', label: 'Quarter' },
  { value: 'all', label: 'All Time' },
] as const;

const DISPOSITION_OPTIONS = [
  { value: 'all', label: 'All Calls' },
  { value: 'dm_only', label: 'DM Conversations' },
  { value: 'meetings_only', label: 'Meetings Set' },
  { value: 'connections', label: 'Connections' },
] as const;

export function TopCallsFilters({ filters, onFiltersChange, availableReps, isLoading }: TopCallsFiltersProps) {
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isRepOpen, setIsRepOpen] = useState(false);

  const updateFilter = <K extends keyof TopCallsFiltersState>(
    key: K,
    value: TopCallsFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleRep = (rep: string) => {
    const newReps = filters.selectedReps.includes(rep)
      ? filters.selectedReps.filter(r => r !== rep)
      : [...filters.selectedReps, rep];
    updateFilter('selectedReps', newReps);
  };

  const clearFilters = () => {
    onFiltersChange({
      dateRange: '7d',
      selectedReps: [],
      disposition: 'all',
      minScore: 0,
    });
  };

  const hasActiveFilters = 
    filters.selectedReps.length > 0 || 
    filters.disposition !== 'all' || 
    filters.minScore > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card border rounded-lg">
      {/* Date Range */}
      <Select
        value={filters.dateRange}
        onValueChange={(v) => updateFilter('dateRange', v as DateRange)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[140px]">
          <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map(preset => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Rep Filter */}
      <Popover open={isRepOpen} onOpenChange={setIsRepOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'min-w-[120px] justify-start',
              filters.selectedReps.length > 0 && 'border-primary'
            )}
            disabled={isLoading}
          >
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            {filters.selectedReps.length > 0 ? (
              <span className="truncate">
                {filters.selectedReps.length} Rep{filters.selectedReps.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span>All Reps</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2" align="start">
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {availableReps.map(rep => (
              <button
                key={rep}
                onClick={() => toggleRep(rep)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors',
                  filters.selectedReps.includes(rep) && 'bg-primary/10 text-primary font-medium'
                )}
              >
                {rep.split('@')[0]}
              </button>
            ))}
          </div>
          {filters.selectedReps.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => updateFilter('selectedReps', [])}
            >
              Clear Selection
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Disposition Filter */}
      <Select
        value={filters.disposition}
        onValueChange={(v) => updateFilter('disposition', v as DispositionFilter)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DISPOSITION_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Min Score Slider */}
      <div className="flex items-center gap-3 px-3 py-2 border rounded-md min-w-[180px]">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Min Score</span>
        <Slider
          value={[filters.minScore]}
          onValueChange={([v]) => updateFilter('minScore', v)}
          min={0}
          max={10}
          step={0.5}
          className="w-20"
          disabled={isLoading}
        />
        <span className="text-sm font-medium w-6">{filters.minScore}</span>
      </div>

      {/* Active Filters Summary & Clear */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="secondary" className="text-xs">
            {[
              filters.selectedReps.length > 0 && `${filters.selectedReps.length} reps`,
              filters.disposition !== 'all' && DISPOSITION_OPTIONS.find(d => d.value === filters.disposition)?.label,
              filters.minScore > 0 && `≥${filters.minScore}`,
            ].filter(Boolean).join(' • ')}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 px-2"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
