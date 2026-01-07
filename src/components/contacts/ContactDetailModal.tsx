import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContactDetail, ContactStatus } from '@/hooks/useContacts';
import { ContactTimeline } from './ContactTimeline';
import { ContactEmailHistory } from './ContactEmailHistory';
import { ContactCallHistory } from './ContactCallHistory';
import { ContactNotes } from './ContactNotes';
import { Mail, Phone, MapPin, Building2, Briefcase, Clock, Star, PhoneOff, MailX } from 'lucide-react';

const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'meeting_set', label: 'Meeting Set' },
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !contact ? (
          <div className="text-center py-12 text-muted-foreground">
            Contact not found
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar placeholder */}
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                    {(contact.first_name?.[0] || contact.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">
                      {contact.first_name || contact.last_name 
                        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                        : contact.email}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                      {contact.title && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-4 w-4" />
                          {contact.title}
                        </span>
                      )}
                      {contact.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-4 w-4" />
                          {contact.company}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {contact.do_not_call && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <PhoneOff className="h-3 w-3" />
                      DNC
                    </Badge>
                  )}
                  {contact.do_not_email && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <MailX className="h-3 w-3" />
                      DNE
                    </Badge>
                  )}
                  <Select 
                    value={contact.contact_status}
                    onValueChange={(value) => {/* TODO: Update status */}}
                  >
                    <SelectTrigger className="w-[150px]">
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
                </div>
              </div>
            </DialogHeader>

            {/* Contact Info Bar */}
            <div className="flex flex-wrap gap-4 text-sm border-b pb-4">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
              </div>
              {contact.phone_number && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${contact.phone_number}`} className="hover:underline">{contact.phone_number}</a>
                </div>
              )}
              {contact.location && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {contact.location}
                </div>
              )}
              {contact.industry && (
                <Badge variant="outline">{contact.industry}</Badge>
              )}
            </div>

            {/* Seller Interest Score */}
            {contact.seller_interest_score && (
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-2xl font-bold">{contact.seller_interest_score}</span>
                  <span className="text-muted-foreground">/10 Seller Interest</span>
                </div>
                {contact.seller_interest_summary && (
                  <p className="text-sm text-muted-foreground flex-1">
                    {contact.seller_interest_summary}
                  </p>
                )}
              </div>
            )}

            {/* Engagement Summary Cards */}
            {engagement && (
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold">{engagement.emails_sent}</div>
                    <div className="text-xs text-muted-foreground">Emails Sent</div>
                    {engagement.emails_sent > 0 && (
                      <div className="text-xs text-green-500 mt-1">
                        {Math.round((engagement.emails_opened / engagement.emails_sent) * 100)}% opened
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold">{engagement.emails_replied}</div>
                    <div className="text-xs text-muted-foreground">Replies</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold">{engagement.total_calls}</div>
                    <div className="text-xs text-muted-foreground">Total Calls</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold">{engagement.calls_connected}</div>
                    <div className="text-xs text-muted-foreground">Connects</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-2xl font-bold flex items-center justify-center gap-1">
                      <Clock className="h-4 w-4" />
                      {Math.floor(engagement.total_talk_time_seconds / 60)}m
                    </div>
                    <div className="text-xs text-muted-foreground">Talk Time</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="timeline" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="emails">Emails</TabsTrigger>
                <TabsTrigger value="calls">Calls</TabsTrigger>
                <TabsTrigger value="notes">Notes & Tags</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="mt-4">
                <ContactTimeline contactId={contactId} />
              </TabsContent>
              <TabsContent value="emails" className="mt-4">
                <ContactEmailHistory contactId={contactId} />
              </TabsContent>
              <TabsContent value="calls" className="mt-4">
                <ContactCallHistory contactId={contactId} />
              </TabsContent>
              <TabsContent value="notes" className="mt-4">
                <ContactNotes 
                  notes={notes} 
                  tags={contact.tags}
                  onAddNote={addNote}
                  onDeleteNote={deleteNote}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
