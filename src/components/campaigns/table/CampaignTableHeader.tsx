import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ColumnDefinition {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface CampaignTableHeaderProps {
  sortConfig: SortConfig;
  onSort: (field: string) => void;
  onSelectAll?: (checked: boolean) => void;
  allSelected?: boolean;
  showCheckbox?: boolean;
  columns: ColumnDefinition[];
}

export function CampaignTableHeader({
  sortConfig,
  onSort,
  onSelectAll,
  allSelected = false,
  showCheckbox = true,
  columns,
}: CampaignTableHeaderProps) {
  const getSortIcon = (field: string) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const getAlignmentClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  return (
    <TableHeader>
      <TableRow>
        {showCheckbox && (
          <TableHead className="w-12">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onSelectAll}
            />
          </TableHead>
        )}
        {columns.map((col) => (
          <TableHead
            key={col.key}
            className={cn(
              col.sortable && 'cursor-pointer hover:bg-muted/50 select-none',
              col.width,
              getAlignmentClass(col.align)
            )}
            onClick={col.sortable ? () => onSort(col.key) : undefined}
          >
            <div className={cn(
              "flex items-center",
              col.align === 'right' && 'justify-end',
              col.align === 'center' && 'justify-center'
            )}>
              {col.label}
              {col.sortable && getSortIcon(col.key)}
            </div>
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
