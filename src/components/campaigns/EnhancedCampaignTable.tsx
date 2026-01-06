import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';
import { calculateCampaignScore, CampaignTier } from './CampaignPortfolioOverview';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Star, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface EnhancedCampaignTableProps {
  campaigns: CampaignWithMetrics[];
}

type SortField = 'name' | 'score' | 'total_sent' | 'reply_rate' | 'positive_rate' | 'meetings';
type SortDirection = 'asc' | 'desc';

interface CampaignWithScore extends CampaignWithMetrics {
  tier: CampaignTier;
  estimatedPositiveRate: number;
  estimatedMeetings: number;
}

export function EnhancedCampaignTable({ campaigns }: EnhancedCampaignTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  const campaignsWithScores: CampaignWithScore[] = useMemo(() => {
    return campaigns.map(campaign => {
      const tier = calculateCampaignScore(campaign);
      const estimatedPositiveRate = campaign.reply_rate * 0.45;
      const estimatedMeetings = Math.round(campaign.total_replied * 0.45 * 0.16);
      return { ...campaign, tier, estimatedPositiveRate, estimatedMeetings };
    });
  }, [campaigns]);

  const statuses = useMemo(() => {
    const unique = [...new Set(campaigns.map(c => c.status))];
    return unique.filter(Boolean).sort();
  }, [campaigns]);

  const filteredAndSortedCampaigns = useMemo(() => {
    let result = [...campaignsWithScores];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(query));
    }

    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    if (tierFilter !== 'all') {
      result = result.filter(c => c.tier.tier === tierFilter);
    }

    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'score':
          aVal = a.tier.score;
          bVal = b.tier.score;
          break;
        case 'positive_rate':
          aVal = a.estimatedPositiveRate;
          bVal = b.estimatedPositiveRate;
          break;
        case 'meetings':
          aVal = a.estimatedMeetings;
          bVal = b.estimatedMeetings;
          break;
        default:
          aVal = a[sortField as keyof CampaignWithMetrics] as number | string;
          bVal = b[sortField as keyof CampaignWithMetrics] as number | string;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [campaignsWithScores, searchQuery, statusFilter, tierFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleCampaign = (id: string) => {
    const newSelected = new Set(selectedCampaigns);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCampaigns(newSelected);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
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

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'star': return <Star className="h-4 w-4 text-yellow-500" />;
      case 'solid': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'optimize': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'problem': return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getActionBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'Scale':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Scale</Badge>;
      case 'Maintain':
        return <Badge className="bg-success/20 text-success border-success/30">Maintain</Badge>;
      case 'Optimize':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Optimize</Badge>;
      case 'Pause':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Pause</Badge>;
      default:
        return <Badge variant="outline">{recommendation}</Badge>;
    }
  };

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
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(status => (
              <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="star">⭐ Stars</SelectItem>
            <SelectItem value="solid">✓ Solid</SelectItem>
            <SelectItem value="optimize">⚠️ Optimize</SelectItem>
            <SelectItem value="problem">🔴 Problems</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredAndSortedCampaigns.length} of {campaigns.length} campaigns
        {selectedCampaigns.size > 0 && ` (${selectedCampaigns.size} selected)`}
      </p>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedCampaigns.size === filteredAndSortedCampaigns.length && filteredAndSortedCampaigns.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedCampaigns(new Set(filteredAndSortedCampaigns.map(c => c.id)));
                    } else {
                      setSelectedCampaigns(new Set());
                    }
                  }}
                />
              </TableHead>
              <SortableHeader field="name" className="min-w-[200px]">Campaign</SortableHeader>
              <SortableHeader field="score" className="w-[80px] text-center">Score</SortableHeader>
              <TableHead className="w-[80px] text-center">Tier</TableHead>
              <SortableHeader field="total_sent" className="text-right">Sent</SortableHeader>
              <SortableHeader field="reply_rate" className="text-right">Reply</SortableHeader>
              <SortableHeader field="positive_rate" className="text-right">Pos %</SortableHeader>
              <SortableHeader field="meetings" className="text-right">Mtgs</SortableHeader>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCampaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No campaigns match your filters
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedCampaigns.map((campaign) => (
                <TableRow key={campaign.id} className="cursor-pointer hover:bg-accent/50">
                  <TableCell>
                    <Checkbox
                      checked={selectedCampaigns.has(campaign.id)}
                      onCheckedChange={() => toggleCampaign(campaign.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to={`/campaigns/${campaign.id}`} className="block">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[280px] hover:text-primary">{campaign.name}</span>
                        <span className="text-xs text-muted-foreground">{campaign.platform}</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold">
                    {Math.round(campaign.tier.score)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getTierIcon(campaign.tier.tier)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {campaign.total_sent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {campaign.reply_rate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {campaign.estimatedPositiveRate.toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {campaign.estimatedMeetings}
                  </TableCell>
                  <TableCell className="text-center">
                    {getActionBadge(campaign.tier.recommendation)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
