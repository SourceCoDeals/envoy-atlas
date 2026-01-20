import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContactDetail } from '@/hooks/useContacts';
import { ContactTimeline } from './ContactTimeline';
import { ContactEmailHistory } from './ContactEmailHistory';
import { ContactCallHistory } from './ContactCallHistory';
import { ContactNotes } from './ContactNotes';
import { Mail, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCallDuration } from '@/lib/metrics';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'working', label: 'Working' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'meeting_set', label: 'Meeting Set' },
  { value: 'nurture', label: 'Nurture' },
  { value: 'disqualified', label: 'Disqualified' },
  { value: 'do_not_contact', label: 'Do Not Contact' },
];

interface ContactDetailModalProps {
  contactId: string | null;
  open: boolean;
  onClose: () => void;
}

export function ContactDetailModal({ contactId, open, onClose }: ContactDetailModalProps) {
  const { contact, engagement, notes, loading, addNote, deleteNote } = useContactDetail(contactId);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !contact ? (
          <div className="text-center py-12 text-muted-foreground">
            Contact not found
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div className="p-6 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary border-2 border-primary/20">
                    {(contact.first_name?.[0] || contact.email?.[0] || 'C').toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {contact.first_name || contact.last_name 
                        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                        : contact.company || contact.email}
                    </h2>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Select defaultValue={contact.contact_status || 'new'}>
                    <SelectTrigger className="w-[120px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Email */}
              {contact.email && (
                <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${contact.email}`} className="hover:underline">
                    {contact.email}
                  </a>
                </div>
              )}
            </div>

            {/* Metrics Bar */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-5 gap-3">
                <MetricCard 
                  label="Emails Sent" 
                  value={engagement?.emails_sent ?? 0} 
                />
                <MetricCard 
                  label="Replies" 
                  value={engagement?.emails_replied ?? 0}
                />
                <MetricCard 
                  label="Total Calls" 
                  value={engagement?.total_calls ?? 0}
                />
                <MetricCard 
                  label="Connects" 
                  value={engagement?.calls_connected ?? 0}
                />
                <MetricCard 
                  label="Talk Time" 
                  value={formatCallDuration(engagement?.total_talk_time_seconds ?? 0)}
                  isTime
                />
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="timeline" className="flex-1">
              <TabsList className="grid w-full grid-cols-4 rounded-none border-t border-b bg-muted/30 h-12">
                <TabsTrigger value="timeline" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="emails" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  Emails
                </TabsTrigger>
                <TabsTrigger value="calls" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  Calls
                </TabsTrigger>
                <TabsTrigger value="notes" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  Notes & Tags
                </TabsTrigger>
              </TabsList>
              
              <div className="max-h-[300px] overflow-y-auto">
                <TabsContent value="timeline" className="m-0 p-4">
                  <ContactTimeline contactId={contactId} />
                </TabsContent>
                <TabsContent value="emails" className="m-0 p-4">
                  <ContactEmailHistory contactId={contactId} />
                </TabsContent>
                <TabsContent value="calls" className="m-0 p-4">
                  <ContactCallHistory contactId={contactId} />
                </TabsContent>
                <TabsContent value="notes" className="m-0 p-4">
                  <ContactNotes 
                    notes={notes} 
                    tags={contact.tags || []}
                    onAddNote={addNote}
                    onDeleteNote={deleteNote}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface MetricCardProps {
  label: string;
  value: number | string;
  isTime?: boolean;
}

function MetricCard({ label, value, isTime }: MetricCardProps) {
  return (
    <Card className="border bg-muted/30">
      <CardContent className="p-3 text-center">
        <div className="text-xl font-bold flex items-center justify-center gap-1">
          {isTime && <Clock className="h-4 w-4 text-muted-foreground" />}
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
