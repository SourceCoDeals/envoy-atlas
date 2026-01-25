import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, ExternalLink, TrendingUp } from 'lucide-react';
import type { TopCampaign } from '@/hooks/useOverviewDashboard';

interface TopPerformersTableProps {
  campaigns: TopCampaign[];
}

export function TopPerformersTable({ campaigns }: TopPerformersTableProps) {
  const navigate = useNavigate();

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-success" />
            <CardTitle className="text-lg">Top Performers</CardTitle>
          </div>
          <CardDescription>Top 5 campaigns by positive reply rate (min 100 emails)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            No campaigns with sufficient volume yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-success/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-success" />
          <CardTitle className="text-lg">Top Performers</CardTitle>
        </div>
        <CardDescription>Top 5 campaigns by positive reply rate (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Reply %</TableHead>
                <TableHead className="text-right">Positive %</TableHead>
                <TableHead className="text-right">Meetings</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign, index) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <span className={`font-bold ${index === 0 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium max-w-[180px] truncate">
                    <Link 
                      to={`/campaigns/${campaign.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {campaign.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {campaign.sent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {campaign.replyRate.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-success font-medium">
                    {campaign.positiveRate.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {campaign.meetingsBooked}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      className="border-success/30 text-success hover:bg-success/10"
                    >
                      <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                      Scale
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden space-y-3">
          {campaigns.map((campaign, index) => (
            <div 
              key={campaign.id}
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3 mb-2">
                <span className={`font-bold text-lg ${index === 0 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <Link 
                    to={`/campaigns/${campaign.id}`}
                    className="font-medium text-sm line-clamp-2 hover:text-primary"
                  >
                    {campaign.name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {campaign.sent.toLocaleString()} sent
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-success font-mono font-medium text-sm">
                    {campaign.positiveRate.toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground">positive</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {campaign.replyRate.toFixed(2)}% reply • {campaign.meetingsBooked} meetings
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-success"
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-1" />
                  Scale
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
