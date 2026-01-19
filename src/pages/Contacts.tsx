import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, Phone, Mail, Filter, ChevronRight } from 'lucide-react';
import { useContacts, ContactStatus } from '@/hooks/useContacts';
import { ContactDetailModal } from '@/components/contacts/ContactDetailModal';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS: Record<ContactStatus, string> = {
  new: 'bg-muted text-muted-foreground',
  contacted: 'bg-blue-500/10 text-blue-500',
  interested: 'bg-green-500/10 text-green-500',
  meeting_set: 'bg-purple-500/10 text-purple-500',
  disqualified: 'bg-destructive/10 text-destructive',
  do_not_contact: 'bg-destructive/10 text-destructive',
};

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  meeting_set: 'Meeting Set',
  disqualified: 'Disqualified',
  do_not_contact: 'Do Not Contact',
};

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const { contacts, loading, totalCount } = useContacts({
    search,
    // Note: status filtering would need to be implemented in useContacts if needed
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="text-muted-foreground">
              Unified view of all prospects across email and calling
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              <Users className="h-4 w-4 mr-2" />
              {totalCount.toLocaleString()} contacts
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ContactStatus | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Contacts Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No contacts found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow 
                      key={contact.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedContactId(contact.id)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {contact.first_name || contact.last_name 
                              ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                              : 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground">{contact.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{contact.company || '-'}</div>
                          <div className="text-sm text-muted-foreground">{contact.title || ''}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[contact.contact_status]}>
                          {STATUS_LABELS[contact.contact_status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {contact.phone_number && (
                            <Phone className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.last_contact_at ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(contact.last_contact_at), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.seller_interest_score ? (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{contact.seller_interest_score}</span>
                            <span className="text-muted-foreground">/10</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contact Detail Modal */}
      <ContactDetailModal
        contactId={selectedContactId}
        open={!!selectedContactId}
        onClose={() => setSelectedContactId(null)}
      />
    </DashboardLayout>
  );
}
