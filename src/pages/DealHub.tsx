import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useDeals, type Deal } from '@/hooks/useDeals';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DataHealthIndicator } from '@/components/ui/data-health-indicator';
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  Users,
  Plus,
  Search,
  FileText,
  Eye,
  MapPin,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

const STAGES = ['New', 'Qualified', 'Under Review', 'Due Diligence', 'Closed Won', 'Closed Lost'];
const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Oil & Gas',
  'Security',
  'Transportation',
  'Real Estate',
  'Other',
];

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getStageColor(stage: string): string {
  switch (stage) {
    case 'New':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Qualified':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Under Review':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Due Diligence':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Closed Won':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Closed Lost':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function DealHub() {
  const { currentWorkspace } = useWorkspace();
  const { deals, clients, stats, loading, createDeal, createClient } = useDeals();

  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    project_name: '',
    business_description: '',
    client_name: '',
    geography: '',
    industry: '',
    revenue: '',
    ebitda: '',
    stage: 'New',
    teaser_url: '',
  });

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch =
        deal.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.business_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.client_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesIndustry = industryFilter === 'all' || deal.industry === industryFilter;
      const matchesStage = stageFilter === 'all' || deal.stage === stageFilter;
      const matchesClient = clientFilter === 'all' || deal.client_name === clientFilter;

      return matchesSearch && matchesIndustry && matchesStage && matchesClient;
    });
  }, [deals, searchQuery, industryFilter, stageFilter, clientFilter]);

  const uniqueClients = useMemo(() => {
    const clientNames = deals.map((d) => d.client_name).filter(Boolean);
    return [...new Set(clientNames)] as string[];
  }, [deals]);

  const uniqueIndustries = useMemo(() => {
    const industries = deals.map((d) => d.industry).filter(Boolean);
    return [...new Set(industries)] as string[];
  }, [deals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id) return;

    setSaving(true);
    try {
      await createDeal({
        project_name: formData.project_name,
        business_description: formData.business_description || null,
        client_name: formData.client_name || null,
        geography: formData.geography || null,
        industry: formData.industry || null,
        sub_industry: null,
        revenue: formData.revenue ? parseFloat(formData.revenue) * 1000000 : null,
        revenue_display: null,
        ebitda: formData.ebitda ? parseFloat(formData.ebitda) * 1000000 : null,
        ebitda_display: null,
        asking_price: null,
        asking_price_display: null,
        revenue_multiple: null,
        ebitda_multiple: null,
        stage: formData.stage,
        teaser_url: formData.teaser_url || null,
        cim_url: null,
        notes: null,
        pass_reason: null,
        source_type: null,
        assigned_to: null,
        received_at: null,
        nda_signed_date: null,
        engagement_id: null,
        deal_client_id: null,
      });

      toast.success('Deal created successfully');
      setAddDialogOpen(false);
      setFormData({
        project_name: '',
        business_description: '',
        client_name: '',
        geography: '',
        industry: '',
        revenue: '',
        ebitda: '',
        stage: 'New',
        teaser_url: '',
      });
    } catch (err) {
      console.error('Error creating deal:', err);
      toast.error('Failed to create deal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">Deal Hub</h1>
              <p className="text-muted-foreground">Track and manage your deal pipeline</p>
            </div>
            <DataHealthIndicator 
              status={deals.length > 0 ? 'healthy' : 'empty'} 
              tooltip={deals.length > 0 ? `${deals.length} deals tracked` : 'No deals. Add your first deal.'}
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalDeals}</p>
                  <p className="text-sm text-muted-foreground">Total Deals</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.avgEbitda)}</p>
                  <p className="text-sm text-muted-foreground">Avg EBITDA</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{uniqueClients.length}</p>
                  <p className="text-sm text-muted-foreground">Brokers</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deal Pipeline */}
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-semibold">Deal Pipeline</h2>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Deal
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>Add New Deal</DialogTitle>
                      <DialogDescription>Enter the deal details below.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="project_name">Project Name *</Label>
                        <Input
                          id="project_name"
                          value={formData.project_name}
                          onChange={(e) =>
                            setFormData({ ...formData, project_name: e.target.value })
                          }
                          placeholder="e.g., Project Willow"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="business_description">Business Description</Label>
                        <Input
                          id="business_description"
                          value={formData.business_description}
                          onChange={(e) =>
                            setFormData({ ...formData, business_description: e.target.value })
                          }
                          placeholder="Brief description of the business"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="client_name">Client/Broker</Label>
                          <Input
                            id="client_name"
                            value={formData.client_name}
                            onChange={(e) =>
                              setFormData({ ...formData, client_name: e.target.value })
                            }
                            placeholder="e.g., Teamshares"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="geography">Geography</Label>
                          <Input
                            id="geography"
                            value={formData.geography}
                            onChange={(e) =>
                              setFormData({ ...formData, geography: e.target.value })
                            }
                            placeholder="e.g., Denver, CO"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="industry">Industry</Label>
                          <Select
                            value={formData.industry}
                            onValueChange={(v) => setFormData({ ...formData, industry: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                              {INDUSTRIES.map((ind) => (
                                <SelectItem key={ind} value={ind}>
                                  {ind}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="stage">Stage</Label>
                          <Select
                            value={formData.stage}
                            onValueChange={(v) => setFormData({ ...formData, stage: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {STAGES.map((stage) => (
                                <SelectItem key={stage} value={stage}>
                                  {stage}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="revenue">Revenue ($ millions)</Label>
                          <Input
                            id="revenue"
                            type="number"
                            step="0.1"
                            value={formData.revenue}
                            onChange={(e) =>
                              setFormData({ ...formData, revenue: e.target.value })
                            }
                            placeholder="e.g., 6.9"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="ebitda">EBITDA ($ millions)</Label>
                          <Input
                            id="ebitda"
                            type="number"
                            step="0.1"
                            value={formData.ebitda}
                            onChange={(e) =>
                              setFormData({ ...formData, ebitda: e.target.value })
                            }
                            placeholder="e.g., 2.8"
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="teaser_url">Teaser URL</Label>
                        <Input
                          id="teaser_url"
                          type="url"
                          value={formData.teaser_url}
                          onChange={(e) =>
                            setFormData({ ...formData, teaser_url: e.target.value })
                          }
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Creating...' : 'Create Deal'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Industries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {uniqueIndustries.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {uniqueClients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Project / Business</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Geography</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">EBITDA</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-center">Teaser</TableHead>
                    <TableHead className="text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {deals.length === 0
                          ? 'No deals yet. Click "Add Deal" to create your first deal.'
                          : 'No deals match your filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeals.map((deal) => (
                      <TableRow key={deal.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div>
                            <p className="font-medium text-primary">{deal.project_name}</p>
                            {deal.business_description && (
                              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {deal.business_description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {deal.client_name ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{deal.client_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {deal.geography ? (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{deal.geography}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{deal.industry || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(deal.revenue)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(deal.ebitda)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStageColor(deal.stage)}>
                            {deal.stage}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {deal.teaser_url ? (
                            <a
                              href={deal.teaser_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Showing {filteredDeals.length} of {deals.length} deals
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
