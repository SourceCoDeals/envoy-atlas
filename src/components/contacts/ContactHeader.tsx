import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Linkedin, Edit, ExternalLink } from 'lucide-react';
import { ContactFull } from '@/hooks/useContactDetailFull';

interface ContactHeaderProps {
  contact: ContactFull;
}

export function ContactHeader({ contact }: ContactHeaderProps) {
  const initials = [contact.first_name?.[0], contact.last_name?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  const stats = [
    { label: 'Emails Sent', value: contact.emails_sent },
    { label: 'Opens', value: contact.emails_opened },
    { label: 'Replies', value: contact.emails_replied },
    { label: 'Calls Made', value: contact.calls_made },
    { label: 'Conversations', value: contact.conversations },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <Avatar className="h-20 w-20 text-2xl">
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Contact Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">
                  {contact.first_name || contact.last_name 
                    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                    : 'Unknown Contact'}
                </h1>
                {contact.title && (
                  <p className="text-lg text-muted-foreground">{contact.title}</p>
                )}
                {contact.company_name && (
                  <p className="text-muted-foreground">{contact.company_name}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                {contact.phone && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${contact.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Contact Details */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              {contact.email && (
                <a 
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-4 w-4" />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {contact.phone}
                </span>
              )}
              {contact.linkedin_url && (
                <a 
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {contact.sequence_status && (
                <Badge variant="outline">{contact.sequence_status}</Badge>
              )}
              {contact.current_step && (
                <Badge variant="secondary">Step {contact.current_step}</Badge>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-5 gap-4 mt-6">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}