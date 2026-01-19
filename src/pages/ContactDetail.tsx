import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useContactDetailFull } from '@/hooks/useContactDetailFull';
import { ContactHeader } from '@/components/contacts/ContactHeader';
import { ContactTimeline } from '@/components/contacts/ContactTimeline';
import { ContactEmailHistory } from '@/components/contacts/ContactEmailHistory';
import { ContactCallHistory } from '@/components/contacts/ContactCallHistory';
import { ContactNotes } from '@/components/contacts/ContactNotes';
import { CompanyInfo } from '@/components/contacts/CompanyInfo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useContactDetail } from '@/hooks/useContacts';

export default function ContactDetail() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { contact, timeline, emails, calls, loading } = useContactDetailFull(contactId);
  const { notes, addNote, deleteNote } = useContactDetail(contactId || null);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!contact) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Contact not found</h2>
          <Button onClick={() => navigate('/contacts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contacts
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/contacts')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Contacts
        </Button>

        <ContactHeader contact={contact} />
        
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="emails">Emails ({emails.length})</TabsTrigger>
            <TabsTrigger value="calls">Calls ({calls.length})</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
          </TabsList>
          
          <TabsContent value="timeline">
            <ContactTimeline contactId={contactId || null} />
          </TabsContent>
          
          <TabsContent value="emails">
            <ContactEmailHistory contactId={contactId || null} />
          </TabsContent>
          
          <TabsContent value="calls">
            <ContactCallHistory contactId={contactId || null} />
          </TabsContent>
          
          <TabsContent value="notes">
            <ContactNotes 
              notes={notes} 
              tags={[]} 
              onAddNote={addNote} 
              onDeleteNote={deleteNote} 
            />
          </TabsContent>
          
          <TabsContent value="company">
            <CompanyInfo companyId={contact.company_id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}