import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

export type DateRangeOption = 'last7' | 'last14' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'all';

interface DateRangeFilterProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
}

export function getDateRange(option: DateRangeOption): { startDate: Date | null; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  switch (option) {
    case 'last7': {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate };
    }
    case 'last14': {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 13);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate };
    }
    case 'last30': {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate };
    }
    case 'last90': {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 89);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate };
    }
    case 'thisMonth': {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate, endDate };
    }
    case 'lastMonth': {
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate, endDate: endOfLastMonth };
    }
    case 'all':
    default:
      return { startDate: null, endDate };
  }
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DateRangeOption)}>
      <SelectTrigger className="w-[160px]">
        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder="Select range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="last7">Last 7 days</SelectItem>
        <SelectItem value="last14">Last 14 days</SelectItem>
        <SelectItem value="last30">Last 30 days</SelectItem>
        <SelectItem value="last90">Last 90 days</SelectItem>
        <SelectItem value="thisMonth">This month</SelectItem>
        <SelectItem value="lastMonth">Last month</SelectItem>
        <SelectItem value="all">All time</SelectItem>
      </SelectContent>
    </Select>
  );
}
