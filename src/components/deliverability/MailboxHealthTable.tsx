import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Mail, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Flame,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { MailboxHealth } from '@/hooks/useDeliverabilityData';

interface MailboxHealthTableProps {
  mailboxes: MailboxHealth[];
  onSelectMailbox?: (id: string) => void;
}

type SortField = 'email' | 'healthScore' | 'bounceRate' | 'dailyLimit';
type SortDirection = 'asc' | 'desc';

export function MailboxHealthTable({ mailboxes, onSelectMailbox }: MailboxHealthTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('email');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const getMailboxStatus = (mailbox: MailboxHealth): 'healthy' | 'warning' | 'critical' | 'warming' => {
    if (mailbox.warmupEnabled && mailbox.warmupPercentage < 100) return 'warming';
    if (mailbox.bounceRate > 5 || mailbox.spamComplaintRate > 0.1) return 'critical';
    if (mailbox.bounceRate > 2 || mailbox.healthScore < 70) return 'warning';
    return 'healthy';
  };

  const uniqueDomains = Array.from(new Set(mailboxes.map(m => m.domain))).sort();

  const filteredMailboxes = mailboxes
    .filter(m => {
      if (search && !m.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (domainFilter !== 'all' && m.domain !== domainFilter) return false;
      if (statusFilter !== 'all') {
        const status = getMailboxStatus(m);
        if (statusFilter !== status) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'healthScore':
          comparison = a.healthScore - b.healthScore;
          break;
        case 'bounceRate':
          comparison = a.bounceRate - b.bounceRate;
          break;
        case 'dailyLimit':
          comparison = a.dailyLimit - b.dailyLimit;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-3 w-3" /> : 
      <ChevronDown className="h-3 w-3" />;
  };

  const getStatusIcon = (status: ReturnType<typeof getMailboxStatus>) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warming':
        return <Flame className="h-4 w-4 text-orange-500" />;
    }
  };

  // Summary stats
  const healthyCount = mailboxes.filter(m => getMailboxStatus(m) === 'healthy').length;
  const warningCount = mailboxes.filter(m => getMailboxStatus(m) === 'warning').length;
  const criticalCount = mailboxes.filter(m => getMailboxStatus(m) === 'critical').length;
  const warmingCount = mailboxes.filter(m => getMailboxStatus(m) === 'warming').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Mailbox Health ({mailboxes.length})
          </CardTitle>
          <div className="flex gap-1 flex-wrap">
            {healthyCount > 0 && (
              <Badge variant="outline" className="text-success border-success/30">
                {healthyCount} healthy
              </Badge>
            )}
            {warmingCount > 0 && (
              <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                {warmingCount} warming
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="text-warning border-warning/30">
                {warningCount} warning
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge variant="outline" className="text-destructive border-destructive/30">
                {criticalCount} critical
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-success">{healthyCount}</p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-orange-500">{warmingCount}</p>
            <p className="text-xs text-muted-foreground">Warming Up</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-warning">{warningCount}</p>
            <p className="text-xs text-muted-foreground">Warning</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search mailboxes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {uniqueDomains.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="warming">Warming</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center gap-1">
                    Email <SortIcon field="email" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-center"
                  onClick={() => handleSort('healthScore')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Health <SortIcon field="healthScore" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Warmup</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-center"
                  onClick={() => handleSort('bounceRate')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Bounce <SortIcon field="bounceRate" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-center"
                  onClick={() => handleSort('dailyLimit')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Daily Limit <SortIcon field="dailyLimit" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Platform</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMailboxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {search || statusFilter !== 'all' || domainFilter !== 'all' 
                      ? 'No mailboxes match your filters' 
                      : 'No mailboxes found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMailboxes.slice(0, 100).map((mailbox) => {
                  const status = getMailboxStatus(mailbox);
                  
                  return (
                    <TableRow 
                      key={mailbox.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSelectMailbox?.(mailbox.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(status)}
                          <div>
                            <p className="font-medium text-sm">{mailbox.email}</p>
                            <p className="text-xs text-muted-foreground">{mailbox.domain}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          className={
                            status === 'healthy' ? 'bg-success/20 text-success border-success/30' :
                            status === 'warming' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' :
                            status === 'warning' ? 'bg-warning/20 text-warning border-warning/30' :
                            'bg-destructive/20 text-destructive border-destructive/30'
                          }
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={mailbox.healthScore} className="w-12 h-1.5" />
                          <span className={
                            mailbox.healthScore >= 80 ? 'text-success' :
                            mailbox.healthScore >= 50 ? 'text-warning' :
                            'text-destructive'
                          }>
                            {Math.round(mailbox.healthScore)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {mailbox.warmupEnabled ? (
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={mailbox.warmupPercentage} className="w-12 h-1.5" />
                            <span className="text-xs">{mailbox.warmupPercentage}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={
                          mailbox.bounceRate > 5 ? 'text-destructive font-medium' :
                          mailbox.bounceRate > 2 ? 'text-warning' :
                          'text-success'
                        }>
                          {mailbox.bounceRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {mailbox.dailyLimit}/day
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs capitalize">
                          {mailbox.platform}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filteredMailboxes.length > 100 && (
            <div className="p-2 text-center text-xs text-muted-foreground border-t">
              Showing first 100 of {filteredMailboxes.length} mailboxes
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
