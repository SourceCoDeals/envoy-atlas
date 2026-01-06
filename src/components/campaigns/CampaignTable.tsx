import { useState, useMemo } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CampaignRow } from './CampaignRow';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface CampaignTableProps {
  campaigns: CampaignWithMetrics[];
}

type SortField = 'name' | 'total_sent' | 'open_rate' | 'click_rate' | 'reply_rate' | 'bounce_rate';
type SortDirection = 'asc' | 'desc';

export function CampaignTable({ campaigns }: CampaignTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('total_sent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const statuses = useMemo(() => {
    const unique = [...new Set(campaigns.map(c => c.status))];
    return unique.filter(Boolean).sort();
  }, [campaigns]);

  const filteredAndSortedCampaigns = useMemo(() => {
    let result = [...campaigns];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(query));
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [campaigns, searchQuery, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/50 transition-colors ${className || ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        <SortIcon field={field} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(status => (
              <SelectItem key={status} value={status} className="capitalize">
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredAndSortedCampaigns.length} of {campaigns.length} campaigns
      </p>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="name" className="w-[300px]">Campaign</SortableHeader>
              <TableHead>Status</TableHead>
              <SortableHeader field="total_sent" className="text-right">Sent</SortableHeader>
              <SortableHeader field="open_rate" className="text-right">Open Rate</SortableHeader>
              <SortableHeader field="click_rate" className="text-right">Click Rate</SortableHeader>
              <SortableHeader field="reply_rate" className="text-right">Reply Rate</SortableHeader>
              <SortableHeader field="bounce_rate" className="text-right">Bounce Rate</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCampaigns.length === 0 ? (
              <TableRow>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  No campaigns match your filters
                </td>
              </TableRow>
            ) : (
              filteredAndSortedCampaigns.map((campaign) => (
                <CampaignRow key={campaign.id} campaign={campaign} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
