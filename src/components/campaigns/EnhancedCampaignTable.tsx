import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DataHealthIndicator } from '@/components/ui/data-health-indicator';
import { CampaignWithMetrics, MetricsStatus } from '@/hooks/useCampaigns';
import { calculateCampaignScore, CampaignTier, ConfidenceLevel } from './CampaignPortfolioOverview';
import { useDataHealth } from '@/hooks/useDataHealth';
import { useCampaignLinking } from '@/hooks/useCampaignLinking';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Star, CheckCircle, AlertTriangle, XCircle, HelpCircle, Circle, Briefcase, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Engagement {
  id: string;
  name: string;
}

interface EnhancedCampaignTableProps {
  campaigns: CampaignWithMetrics[];
  tierFilter?: string;
  onTierFilterChange?: (tier: string) => void;
  engagementFilter?: string;
  onEngagementFilterChange?: (id: string) => void;
  engagements?: Engagement[];
  onCampaignUpdated?: () => void;
}

type SortField = 'name' | 'score' | 'total_leads' | 'updated_at' | 'total_sent' | 'reply_rate' | 'positive_rate' | 'meetings' | 'confidence' | 'engagement_name';
type SortDirection = 'asc' | 'desc';

interface CampaignWithScore extends CampaignWithMetrics {
  tier: CampaignTier;
  estimatedPositiveRate: number;
  estimatedMeetings: number;
  hasMetrics: boolean;
}

const getConfidenceIcon = (confidence: ConfidenceLevel) => {
  switch (confidence) {
    case 'high':
      return <Circle className="h-3 w-3 fill-success text-success" />;
    case 'good':
      return <Circle className="h-3 w-3 fill-success/70 text-success/70" />;
    case 'medium':
      return <Circle className="h-3 w-3 fill-warning text-warning" />;
    case 'low':
      return <Circle className="h-3 w-3 fill-warning/60 text-warning/60" />;
    default:
      return <Circle className="h-3 w-3 fill-muted text-muted-foreground" />;
  }
};

const getConfidenceLabel = (confidence: ConfidenceLevel) => {
  switch (confidence) {
    case 'high': return 'High (1000+)';
    case 'good': return 'Good (500-999)';
    case 'medium': return 'Medium (200-499)';
    case 'low': return 'Low (50-199)';
    default: return 'Insufficient (<50)';
  }
};

const getTierRowClass = (tier: CampaignTier['tier']) => {
  switch (tier) {
    case 'star':
      return 'border-l-4 border-l-yellow-500 bg-yellow-500/5';
    case 'solid':
      return 'border-l-4 border-l-success bg-success/5';
    case 'optimize':
      return 'border-l-4 border-l-warning bg-warning/5';
    case 'problem':
      return 'border-l-4 border-l-destructive bg-destructive/5';
    default:
      return 'border-l-4 border-l-muted';
  }
};

export function EnhancedCampaignTable({ 
  campaigns, 
  tierFilter = 'all',
  onTierFilterChange,
  engagementFilter = 'all',
  onEngagementFilterChange,
  engagements = [],
  onCampaignUpdated,
}: EnhancedCampaignTableProps) {
  const { health: dataHealth } = useDataHealth();
  const { updateCampaignEngagement, updating } = useCampaignLinking();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [localTierFilter, setLocalTierFilter] = useState<string>(tierFilter);
  const [localEngagementFilter, setLocalEngagementFilter] = useState<string>(engagementFilter);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  // Handle engagement assignment change for a campaign row
  const handleCampaignEngagementAssign = useCallback(async (campaignId: string, newEngagementId: string) => {
    const success = await updateCampaignEngagement(
      campaignId, 
      newEngagementId === 'unlinked' ? null : newEngagementId
    );
    if (success && onCampaignUpdated) {
      onCampaignUpdated();
    }
  }, [updateCampaignEngagement, onCampaignUpdated]);

  // Phase C: Check if metrics are broken
  const isMetricsBroken = dataHealth?.email.metrics.status === 'broken';

  // Sync external tier filter with local state
  useEffect(() => {
    setLocalTierFilter(tierFilter);
  }, [tierFilter]);

  // Sync external engagement filter with local state
  useEffect(() => {
    setLocalEngagementFilter(engagementFilter);
  }, [engagementFilter]);

  const handleTierChange = (value: string) => {
    setLocalTierFilter(value);
    onTierFilterChange?.(value);
  };

  const handleEngagementChange = (value: string) => {
    setLocalEngagementFilter(value);
    onEngagementFilterChange?.(value);
  };

  // Derive unique engagements from campaigns for counts
  const uniqueEngagements = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    campaigns.forEach(c => {
      if (c.engagement_id && c.engagement_name) {
        const existing = map.get(c.engagement_id);
        if (existing) {
          existing.count++;
        } else {
          map.set(c.engagement_id, { id: c.engagement_id, name: c.engagement_name, count: 1 });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [campaigns]);

  const unlinkedCount = campaigns.filter(c => !c.engagement_id).length;

  const campaignsWithScores: CampaignWithScore[] = useMemo(() => {
    return campaigns.map(campaign => {
      const tier = calculateCampaignScore(campaign);
      // Use actual positive_rate from campaign data (synced from platform)
      const actualPositiveRate = campaign.positive_rate || 0;
      // Meetings are not tracked from email campaigns - requires calendar integration
      const actualMeetings = 0;
      // Check if campaign has any actual metrics data
      const hasMetrics = campaign.total_sent > 0 || campaign.total_replied > 0;
      return { ...campaign, tier, estimatedPositiveRate: actualPositiveRate, estimatedMeetings: actualMeetings, hasMetrics };
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

    if (localTierFilter !== 'all') {
      result = result.filter(c => c.tier.tier === localTierFilter);
    }

    // Filter by engagement
    if (localEngagementFilter === 'unlinked') {
      result = result.filter(c => !c.engagement_id);
    } else if (localEngagementFilter !== 'all') {
      result = result.filter(c => c.engagement_id === localEngagementFilter);
    }

    // Sort: active statuses first, then by selected field
    const activeStatuses = ['active', 'started', 'running'];
    result.sort((a, b) => {
      const aIsActive = activeStatuses.includes(a.status.toLowerCase());
      const bIsActive = activeStatuses.includes(b.status.toLowerCase());
      
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      
      let aVal: number | string | null;
      let bVal: number | string | null;

      switch (sortField) {
        case 'score':
          aVal = a.tier.score ?? -1;
          bVal = b.tier.score ?? -1;
          break;
        case 'positive_rate':
          aVal = a.estimatedPositiveRate;
          bVal = b.estimatedPositiveRate;
          break;
        case 'meetings':
          aVal = a.estimatedMeetings;
          bVal = b.estimatedMeetings;
          break;
        case 'confidence':
          const confOrder = { high: 5, good: 4, medium: 3, low: 2, none: 1 };
          aVal = confOrder[a.tier.confidence];
          bVal = confOrder[b.tier.confidence];
          break;
        case 'updated_at':
          aVal = new Date(a.updated_at).getTime();
          bVal = new Date(b.updated_at).getTime();
          break;
        case 'engagement_name':
          aVal = a.engagement_name || '';
          bVal = b.engagement_name || '';
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
  }, [campaignsWithScores, searchQuery, statusFilter, localTierFilter, sortField, sortDirection]);

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

  const getTierBadge = (tier: CampaignTier['tier']) => {
    switch (tier) {
      case 'star': 
        return (
          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 gap-1">
            <Star className="h-3 w-3" />
            Star
          </Badge>
        );
      case 'solid': 
        return (
          <Badge className="bg-success/20 text-success border-success/30 gap-1">
            <CheckCircle className="h-3 w-3" />
            Solid
          </Badge>
        );
      case 'optimize': 
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Optimize
          </Badge>
        );
      case 'problem': 
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
            <XCircle className="h-3 w-3" />
            Problem
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <HelpCircle className="h-3 w-3" />
            Needs Data
          </Badge>
        );
    }
  };

  const getActionBadge = (tier: CampaignTier) => {
    const { recommendation, confidence } = tier;
    
    switch (recommendation) {
      case 'Scale':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Scale</Badge>;
      case 'Scale (verify)':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Scale ⚠️</Badge>;
      case 'Maintain':
        return <Badge className="bg-success/20 text-success border-success/30">Maintain</Badge>;
      case 'Optimize':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Optimize</Badge>;
      case 'Pause':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Pause</Badge>;
      case 'Gather Data':
        return <Badge variant="outline" className="text-muted-foreground">Gather Data</Badge>;
      default:
        return <Badge variant="outline">{recommendation}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const isPaused = status === 'paused' || status === 'stopped';
    const isActive = status === 'active' || status === 'running';
    
    if (isPaused) {
      return <Badge variant="outline" className="text-muted-foreground bg-muted/50">Paused</Badge>;
    }
    if (isActive) {
      return <Badge variant="outline" className="text-success bg-success/10 border-success/30">Active</Badge>;
    }
    return <Badge variant="outline" className="capitalize">{status}</Badge>;
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
        <Select value={localTierFilter} onValueChange={handleTierChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="star">⭐ Stars</SelectItem>
            <SelectItem value="solid">✓ Solid</SelectItem>
            <SelectItem value="optimize">⚠️ Optimize</SelectItem>
            <SelectItem value="problem">🔴 Problems</SelectItem>
            <SelectItem value="insufficient">❓ Needs Data</SelectItem>
          </SelectContent>
        </Select>
        <Select value={localEngagementFilter} onValueChange={handleEngagementChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Engagement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engagements ({campaigns.length})</SelectItem>
            <SelectItem value="unlinked">
              <span className="flex items-center gap-1.5">
                <span className="text-warning">⚠️</span>
                Unlinked Only ({unlinkedCount})
              </span>
            </SelectItem>
            {uniqueEngagements.map(e => (
              <SelectItem key={e.id} value={e.id}>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate max-w-[140px]">{e.name}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1">{e.count}</Badge>
                </span>
              </SelectItem>
            ))}
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
              <SortableHeader field="engagement_name" className="min-w-[120px]">Engagement</SortableHeader>
              <SortableHeader field="score" className="w-[70px] text-center">Score</SortableHeader>
              <TableHead className="w-[90px] text-center">Tier</TableHead>
              <SortableHeader field="confidence" className="w-[60px] text-center">Conf</SortableHeader>
              <TableHead className="w-[80px] text-center">Status</TableHead>
              <SortableHeader field="total_leads" className="text-right">Leads</SortableHeader>
              <SortableHeader field="updated_at" className="text-right">Updated</SortableHeader>
              <SortableHeader field="total_sent" className="text-right">Sent</SortableHeader>
              <SortableHeader field="reply_rate" className="text-right">Reply %</SortableHeader>
              <SortableHeader field="positive_rate" className="text-right">Pos %</SortableHeader>
              <SortableHeader field="meetings" className="text-right">Mtgs</SortableHeader>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCampaigns.length === 0 ? (
            <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                  No campaigns match your filters
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedCampaigns.map((campaign) => (
                <TableRow 
                  key={campaign.id} 
                  className={`cursor-pointer hover:bg-accent/50 ${getTierRowClass(campaign.tier.tier)}`}
                >
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
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[260px] hover:text-primary">{campaign.name}</span>

                          {/*
                            Visual truth-first status:
                            - Reply.io platform broken => mark all Reply.io rows as broken
                            - Active campaign with no verified metrics => broken (red)
                            - Otherwise, missing metrics => empty (gray)
                          */}
                          {(() => {
                            const isActive = ['active', 'running', 'started'].includes((campaign.status || '').toLowerCase());
                            const isReplyioRowBroken = campaign.platform === 'replyio' && isMetricsBroken;
                            const isActiveButNoVerified = isActive && campaign.metricsStatus !== 'verified' && campaign.total_sent === 0;

                            if (isReplyioRowBroken || campaign.metricsStatus === 'broken' || isActiveButNoVerified) {
                              return (
                                <DataHealthIndicator
                                  status="broken"
                                  size="sm"
                                  showLabel={false}
                                  tooltip={
                                    isReplyioRowBroken
                                      ? 'Reply.io sent metrics broken — resync required from Settings → Connections'
                                      : 'Active campaign but no verified send metrics available'
                                  }
                                />
                              );
                            }

                            if (campaign.metricsStatus === 'missing' && !campaign.hasMetrics) {
                              return (
                                <DataHealthIndicator
                                  status="empty"
                                  size="sm"
                                  showLabel={false}
                                  tooltip="No metrics yet"
                                />
                              );
                            }

                            return null;
                          })()}
                        </div>
                        <span className="text-xs text-muted-foreground">{campaign.platform}</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={campaign.engagement_id || 'unlinked'}
                      onValueChange={(value) => handleCampaignEngagementAssign(campaign.id, value)}
                      disabled={updating === campaign.id}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        {updating === campaign.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <SelectValue>
                            {campaign.engagement_name ? (
                              <div className="flex items-center gap-1.5 truncate">
                                <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="truncate">{campaign.engagement_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Unlinked</span>
                            )}
                          </SelectValue>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unlinked">
                          <span className="text-muted-foreground">— Unlinked —</span>
                        </SelectItem>
                        {engagements.map(e => (
                          <SelectItem key={e.id} value={e.id}>
                            <div className="flex items-center gap-1.5">
                              <Briefcase className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[120px]">{e.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="font-mono font-bold">
                            {campaign.tier.score !== null ? campaign.tier.score : '—'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-medium mb-2">Score Breakdown</p>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span>Efficiency (reply & pos rate)</span>
                              <span>{campaign.tier.scoreBreakdown.efficiency}/40</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Reliability (bounce rate)</span>
                              <span>{campaign.tier.scoreBreakdown.reliability}/20</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Health (delivery)</span>
                              <span>{campaign.tier.scoreBreakdown.health}/20</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Momentum (volume)</span>
                              <span>{campaign.tier.scoreBreakdown.momentum}/20</span>
                            </div>
                          </div>
                          {campaign.tier.confidence !== 'high' && campaign.tier.confidence !== 'good' && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              Score reduced due to low sample size
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">
                    {getTierBadge(campaign.tier.tier)}
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center justify-center gap-1">
                            {getConfidenceIcon(campaign.tier.confidence)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getConfidenceLabel(campaign.tier.confidence)}</p>
                          <p className="text-xs text-muted-foreground">Based on sample size</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(campaign.status)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {campaign.total_leads.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {format(new Date(campaign.updated_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {/* Show — when metrics aren't verified (avoids misleading zeros) */}
                    {campaign.metricsStatus === 'verified' ? (
                      campaign.total_sent.toLocaleString()
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {campaign.metricsStatus === 'verified' && campaign.total_sent > 0 ? (
                      `${campaign.reply_rate.toFixed(1)}%`
                    ) : (
                      <span className={campaign.platform === 'replyio' && isMetricsBroken ? 'text-destructive' : 'text-muted-foreground'}>—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    —
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    —
                  </TableCell>
                  <TableCell className="text-center">
                    {getActionBadge(campaign.tier)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-2">
          <span className="font-medium">Tiers:</span>
          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500" /> Star (Scale)</span>
          <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-success" /> Solid (Maintain)</span>
          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-warning" /> Optimize (Fix)</span>
          <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> Problem (Pause)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">Confidence:</span>
          <span className="flex items-center gap-1"><Circle className="h-3 w-3 fill-success text-success" /> High (1000+)</span>
          <span className="flex items-center gap-1"><Circle className="h-3 w-3 fill-warning text-warning" /> Med (200-499)</span>
          <span className="flex items-center gap-1"><Circle className="h-3 w-3 fill-muted text-muted" /> None (&lt;50)</span>
        </div>
      </div>
    </div>
  );
}