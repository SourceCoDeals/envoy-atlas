import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { STEP_LABELS } from '@/lib/textUtils';

interface PlaybookFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  stepFilter: string;
  onStepFilterChange: (value: string) => void;
  confidenceFilter: string;
  onConfidenceFilterChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  minSends: number;
  onMinSendsChange: (value: number) => void;
}

export function PlaybookFilters({
  searchQuery,
  onSearchChange,
  stepFilter,
  onStepFilterChange,
  confidenceFilter,
  onConfidenceFilterChange,
  sortBy,
  onSortChange,
  minSends,
  onMinSendsChange,
}: PlaybookFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      
      <Select value={stepFilter} onValueChange={onStepFilterChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Step" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Steps</SelectItem>
          {Object.entries(STEP_LABELS).map(([key, label]) => (
            key !== 'unknown' && (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            )
          ))}
        </SelectContent>
      </Select>
      
      <Select value={confidenceFilter} onValueChange={onConfidenceFilterChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Confidence" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Confidence</SelectItem>
          <SelectItem value="high">High Only (500+)</SelectItem>
          <SelectItem value="medium">Medium+ (200+)</SelectItem>
        </SelectContent>
      </Select>
      
      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="reply_rate">Reply Rate</SelectItem>
          <SelectItem value="positive_rate">Positive Rate</SelectItem>
          <SelectItem value="sent_count">Most Sends</SelectItem>
        </SelectContent>
      </Select>
      
      <Select value={minSends.toString()} onValueChange={(v) => onMinSendsChange(parseInt(v))}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Min sends" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="50">50+ sends</SelectItem>
          <SelectItem value="100">100+ sends</SelectItem>
          <SelectItem value="200">200+ sends</SelectItem>
          <SelectItem value="500">500+ sends</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
