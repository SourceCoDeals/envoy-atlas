import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PhoneBurnerFilters as FilterType, DateRangeOption } from '@/hooks/usePhoneBurnerData';

interface PhoneBurnerFiltersProps {
  filters: FilterType;
  setFilters: (filters: FilterType) => void;
  filterOptions: {
    analysts: (string | null)[];
    categories: (string | null)[];
    opportunities: (string | null)[];
  };
}

const dateRangeOptions: { value: DateRangeOption; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '14d', label: 'Last 14 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
];

const durationRangeOptions = [
  { value: 'all', label: 'All Durations' },
  { value: '0-30', label: '0-30 seconds' },
  { value: '30-60', label: '30-60 seconds' },
  { value: '60-120', label: '1-2 minutes' },
  { value: '120+', label: '2+ minutes' },
];

export function PhoneBurnerFilters({ filters, setFilters, filterOptions }: PhoneBurnerFiltersProps) {
  const updateFilter = (key: keyof FilterType, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <Card className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Date Range */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Date Range</Label>
          <Select value={filters.dateRange} onValueChange={(v) => updateFilter('dateRange', v as DateRangeOption)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRangeOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Analyst */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Analyst</Label>
          <Select value={filters.analyst} onValueChange={(v) => updateFilter('analyst', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Analysts</SelectItem>
              {filterOptions.analysts.map(analyst => (
                <SelectItem key={analyst} value={analyst || 'unknown'}>{analyst}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select value={filters.category} onValueChange={(v) => updateFilter('category', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {filterOptions.categories.map(cat => (
                <SelectItem key={cat} value={cat || 'unknown'}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Primary Opportunity */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Primary Opportunity</Label>
          <Select value={filters.primaryOpportunity} onValueChange={(v) => updateFilter('primaryOpportunity', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Opportunities</SelectItem>
              {filterOptions.opportunities.map(opp => (
                <SelectItem key={opp} value={opp || 'unknown'}>{opp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Duration Range */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Call Duration</Label>
          <Select value={filters.durationRange} onValueChange={(v) => updateFilter('durationRange', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {durationRangeOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
