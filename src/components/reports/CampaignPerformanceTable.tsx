import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Trophy, Medal, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CampaignPerformance } from '@/hooks/useMonthlyReportData';

interface CampaignPerformanceTableProps {
  campaigns: CampaignPerformance[];
}

type SortField = 'name' | 'sent' | 'replyRate' | 'positiveRate' | 'bounceRate';
type SortDirection = 'asc' | 'desc';

export function CampaignPerformanceTable({ campaigns }: CampaignPerformanceTableProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('replyRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const modifier = sortDirection === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * modifier;
    }
    return ((aVal as number) - (bVal as number)) * modifier;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        <SortIcon field={field} />
      </div>
    </TableHead>
  );

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (index === 1) return <Medal className="h-4 w-4 text-gray-400" />;
    if (index === 2) return <Award className="h-4 w-4 text-amber-700" />;
    return null;
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'active' || statusLower === 'running') {
      return <Badge variant="default" className="bg-[hsl(var(--success))] text-white">Active</Badge>;
    }
    if (statusLower === 'paused') {
      return <Badge variant="secondary">Paused</Badge>;
    }
    if (statusLower === 'completed' || statusLower === 'finished') {
      return <Badge variant="outline">Completed</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campaign Performance</CardTitle>
        <p className="text-sm text-muted-foreground">
          Showing {sortedCampaigns.length} campaigns with activity this month
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <SortableHeader field="name">Campaign</SortableHeader>
              <TableHead>Status</TableHead>
              <SortableHeader field="sent">Sent</SortableHeader>
              <SortableHeader field="replyRate">Reply %</SortableHeader>
              <SortableHeader field="positiveRate">Positive %</SortableHeader>
              <SortableHeader field="bounceRate">Bounce %</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCampaigns.slice(0, 15).map((campaign, idx) => {
              const originalRank = campaigns.findIndex(c => c.id === campaign.id);
              
              return (
                <TableRow 
                  key={campaign.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getRankIcon(originalRank)}
                      <span className="text-muted-foreground text-sm">{idx + 1}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {campaign.name}
                  </TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell className="tabular-nums">{campaign.sent.toLocaleString()}</TableCell>
                  <TableCell className={`tabular-nums font-medium ${
                    campaign.replyRate >= 3 
                      ? 'text-[hsl(var(--success))]' 
                      : campaign.replyRate >= 1 
                        ? 'text-foreground' 
                        : 'text-[hsl(var(--warning))]'
                  }`}>
                    {campaign.replyRate.toFixed(2)}%
                  </TableCell>
                  <TableCell className={`tabular-nums ${
                    campaign.positiveRate >= 1.5 
                      ? 'text-[hsl(var(--success))]' 
                      : 'text-foreground'
                  }`}>
                    {campaign.positiveRate.toFixed(2)}%
                  </TableCell>
                  <TableCell className={`tabular-nums ${
                    campaign.bounceRate > 5 
                      ? 'text-destructive' 
                      : campaign.bounceRate > 3 
                        ? 'text-[hsl(var(--warning))]' 
                        : 'text-foreground'
                  }`}>
                    {campaign.bounceRate.toFixed(2)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {sortedCampaigns.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No campaigns with activity this month
          </div>
        )}

        {sortedCampaigns.length > 15 && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => navigate('/campaigns')}>
              View All {sortedCampaigns.length} Campaigns
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
