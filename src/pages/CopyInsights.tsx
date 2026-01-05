import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, TrendingUp, TrendingDown, Search, ArrowUpDown, ExternalLink } from 'lucide-react';
import { useCopyInsights, CopyPerformance } from '@/hooks/useCopyInsights';
import { Link } from 'react-router-dom';

type SortField = 'reply_rate' | 'open_rate' | 'click_rate' | 'positive_rate' | 'sent_count';
type SortOrder = 'asc' | 'desc';

export default function CopyInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useCopyInsights();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('reply_rate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredData = data
    .filter(item => 
      item.subject_line?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.campaign_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.variant_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const topPerformers = filteredData.filter(d => d.sent_count > 0).slice(0, 3);

  const formatRate = (rate: number) => {
    return `${rate.toFixed(1)}%`;
  };

  const getRateBadge = (rate: number, type: 'reply' | 'open' | 'click') => {
    const thresholds = {
      reply: { good: 3, great: 5 },
      open: { good: 30, great: 50 },
      click: { good: 2, great: 4 },
    };
    const t = thresholds[type];
    
    if (rate >= t.great) {
      return <Badge className="bg-success/20 text-success border-success/30">High</Badge>;
    } else if (rate >= t.good) {
      return <Badge className="bg-warning/20 text-warning border-warning/30">Average</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const hasData = data.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Copy Insights</h1>
            <p className="text-muted-foreground">
              Analyze subject lines and email copy performance
            </p>
          </div>
          {!hasData && (
            <Button asChild>
              <Link to="/connections">
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect & Sync Data
              </Link>
            </Button>
          )}
        </div>

        {!hasData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-chart-4/10 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-chart-4" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Copy Data Yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Connect your Smartlead account and pull your campaign history to see 
                which subject lines and email copy drive the most replies.
              </p>
              <Button asChild>
                <Link to="/connections">Go to Connections</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top Performers */}
            {topPerformers.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {topPerformers.map((item, index) => (
                  <Card key={item.variant_id} className={index === 0 ? 'border-success/50' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1} Top Performer
                        </Badge>
                        {index === 0 && (
                          <TrendingUp className="h-4 w-4 text-success" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium text-sm line-clamp-2 mb-2">
                        {item.subject_line}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatRate(item.reply_rate)} reply</span>
                        <span>{formatRate(item.open_rate)} open</span>
                        <span>{item.sent_count.toLocaleString()} sent</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        {item.campaign_name}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Search and Filters */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subject Line Performance</CardTitle>
                    <CardDescription>
                      All subject lines ranked by performance metrics
                    </CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search subject lines..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Subject Line</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-auto p-0 font-medium"
                          onClick={() => handleSort('sent_count')}
                        >
                          Sent
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-auto p-0 font-medium"
                          onClick={() => handleSort('open_rate')}
                        >
                          Open Rate
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-auto p-0 font-medium"
                          onClick={() => handleSort('click_rate')}
                        >
                          Click Rate
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-auto p-0 font-medium"
                          onClick={() => handleSort('reply_rate')}
                        >
                          Reply Rate
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No results found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((item) => (
                        <TableRow key={item.variant_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium line-clamp-1">{item.subject_line}</p>
                              <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.campaign_name}
                          </TableCell>
                          <TableCell>{item.sent_count.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {formatRate(item.open_rate)}
                              {getRateBadge(item.open_rate, 'open')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {formatRate(item.click_rate)}
                              {getRateBadge(item.click_rate, 'click')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {formatRate(item.reply_rate)}
                              {getRateBadge(item.reply_rate, 'reply')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
