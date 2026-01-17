import { BarChart3, Mail, Phone, Target, Clock, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ReportSection {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description?: string;
}

export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: 'executive',
    label: 'Executive Summary',
    shortLabel: 'Summary',
    icon: BarChart3,
    description: 'High-level overview of engagement performance',
  },
  {
    id: 'email',
    label: 'Email Report',
    shortLabel: 'Email',
    icon: Mail,
    description: 'Email campaign performance and deliverability',
  },
  {
    id: 'calling',
    label: 'Calling Report',
    shortLabel: 'Calling',
    icon: Phone,
    description: 'Cold calling metrics and outcomes',
  },
  {
    id: 'pipeline',
    label: 'Pipeline & Meetings',
    shortLabel: 'Pipeline',
    icon: Target,
    description: 'Meeting outcomes and opportunity pipeline',
  },
  {
    id: 'activity',
    label: 'Activity Timeline',
    shortLabel: 'Activity',
    icon: Clock,
    description: 'Recent engagement activities and events',
  },
  {
    id: 'targets',
    label: 'Targets & Lists',
    shortLabel: 'Targets',
    icon: Users,
    description: 'Target company coverage and list quality',
  },
];
