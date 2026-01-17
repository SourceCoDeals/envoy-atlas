import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Globe, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldX,
  ChevronDown,
  ChevronUp,
  Mail,
} from 'lucide-react';
import type { DomainHealth } from '@/hooks/useDeliverabilityData';

interface DomainHealthTableProps {
  domains: DomainHealth[];
  onSelectDomain?: (domain: string) => void;
}

type SortField = 'domain' | 'mailboxCount' | 'avgBounceRate' | 'avgHealthScore';
type SortDirection = 'asc' | 'desc';

export function DomainHealthTable({ domains, onSelectDomain }: DomainHealthTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('domain');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const getAuthStatus = (domain: DomainHealth) => {
    const count = [domain.spfValid, domain.dkimValid, domain.dmarcValid].filter(Boolean).length;
    return { count, total: 3 };
  };

  const getDomainStatus = (domain: DomainHealth): 'healthy' | 'warning' | 'critical' => {
    if (domain.blacklistStatus !== 'clean') return 'critical';
    if (domain.avgBounceRate > 5) return 'critical';
    if (domain.avgBounceRate > 2) return 'warning';
    const auth = getAuthStatus(domain);
    if (auth.count < 3) return 'warning';
    if (domain.avgHealthScore < 50) return 'warning';
    return 'healthy';
  };

  const filteredDomains = domains
    .filter(d => {
      if (search && !d.domain.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all') {
        const status = getDomainStatus(d);
        if (statusFilter !== status) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'domain':
          comparison = a.domain.localeCompare(b.domain);
          break;
        case 'mailboxCount':
          comparison = a.mailboxCount - b.mailboxCount;
          break;
        case 'avgBounceRate':
          comparison = a.avgBounceRate - b.avgBounceRate;
          break;
        case 'avgHealthScore':
          comparison = a.avgHealthScore - b.avgHealthScore;
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

  const healthyCount = domains.filter(d => getDomainStatus(d) === 'healthy').length;
  const warningCount = domains.filter(d => getDomainStatus(d) === 'warning').length;
  const criticalCount = domains.filter(d => getDomainStatus(d) === 'critical').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domain Health ({domains.length})
          </CardTitle>
          <div className="flex gap-1">
            {healthyCount > 0 && (
              <Badge variant="outline" className="text-success border-success/30">
                {healthyCount} healthy
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
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search domains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('domain')}
                >
                  <div className="flex items-center gap-1">
                    Domain <SortIcon field="domain" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-center"
                  onClick={() => handleSort('mailboxCount')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Mailboxes <SortIcon field="mailboxCount" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Auth</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-center"
                  onClick={() => handleSort('avgBounceRate')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Bounce <SortIcon field="avgBounceRate" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 text-center"
                  onClick={() => handleSort('avgHealthScore')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Health <SortIcon field="avgHealthScore" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Blacklist</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDomains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {search || statusFilter !== 'all' ? 'No domains match your filters' : 'No domains found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDomains.map((domain) => {
                  const auth = getAuthStatus(domain);
                  const status = getDomainStatus(domain);
                  
                  return (
                    <TableRow 
                      key={domain.domain}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSelectDomain?.(domain.domain)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          {domain.domain}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{domain.mailboxCount}</span>
                          {domain.warmingUpCount > 0 && (
                            <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30 ml-1">
                              {domain.warmingUpCount} warming
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {auth.count === 3 ? (
                            <ShieldCheck className="h-4 w-4 text-success" />
                          ) : auth.count > 0 ? (
                            <Shield className="h-4 w-4 text-warning" />
                          ) : (
                            <ShieldX className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-xs text-muted-foreground">{auth.count}/3</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={
                          domain.avgBounceRate > 5 ? 'text-destructive font-medium' :
                          domain.avgBounceRate > 2 ? 'text-warning' :
                          'text-success'
                        }>
                          {domain.avgBounceRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={
                          domain.avgHealthScore >= 80 ? 'text-success' :
                          domain.avgHealthScore >= 50 ? 'text-warning' :
                          'text-destructive'
                        }>
                          {Math.round(domain.avgHealthScore)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {domain.blacklistStatus === 'clean' ? (
                          <CheckCircle className="h-4 w-4 text-success mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          className={
                            status === 'healthy' ? 'bg-success/20 text-success border-success/30' :
                            status === 'warning' ? 'bg-warning/20 text-warning border-warning/30' :
                            'bg-destructive/20 text-destructive border-destructive/30'
                          }
                        >
                          {status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
