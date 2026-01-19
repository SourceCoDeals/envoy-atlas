import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { TeamMember } from '@/hooks/useTeamMembers';

export interface EngagementFormData {
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  meeting_goal: number;
  target_list_size: number;
  sponsor_name: string;
  portfolio_company: string;
  fee_schedule: string;
  monthly_retainer: number | null;
  is_platform: boolean;
  deal_lead_id: string | null;
  associate_id: string | null;
  analyst_id: string | null;
  analyst_2_id: string | null;
  research_lead_id: string | null;
  research_mid_id: string | null;
}

interface EngagementFormProps {
  formData: EngagementFormData;
  onChange: (data: EngagementFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit: boolean;
  teamMembers: TeamMember[];
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Live' },
  { value: 'contracted', label: 'Contracted' },
  { value: 'paused', label: 'Paused' },
  { value: 'transitioned', label: 'Transitioned' },
  { value: 'closed', label: 'Complete' },
];

function TeamMemberSelect({
  label,
  value,
  onChange,
  teamMembers,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  teamMembers: TeamMember[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || ''} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger>
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Unassigned</SelectItem>
          {teamMembers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.first_name} {m.last_name || ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function EngagementForm({
  formData,
  onChange,
  onSave,
  onCancel,
  saving,
  isEdit,
  teamMembers,
}: EngagementFormProps) {
  const activeMembers = teamMembers.filter((m) => m.is_active);

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">Basic Info</h4>
        
        <div className="space-y-2">
          <Label htmlFor="name">Engagement Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            placeholder="e.g., Trivest - ABC Holdings"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sponsor_name">Sponsor (PE Firm)</Label>
            <Input
              id="sponsor_name"
              value={formData.sponsor_name}
              onChange={(e) => onChange({ ...formData, sponsor_name: e.target.value })}
              placeholder="e.g., Trivest Partners"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolio_company">Portfolio Company</Label>
            <Input
              id="portfolio_company"
              value={formData.portfolio_company}
              onChange={(e) => onChange({ ...formData, portfolio_company: e.target.value })}
              placeholder="e.g., ABC Holdings"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            placeholder="Brief description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => onChange({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 h-[42px] self-end">
            <Label>Platform</Label>
            <Switch
              checked={formData.is_platform}
              onCheckedChange={(checked) => onChange({ ...formData, is_platform: checked })}
            />
          </div>
        </div>
      </div>

      {/* Dates & Goals */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">Dates & Goals</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => onChange({ ...formData, start_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              type="date"
              value={formData.end_date}
              onChange={(e) => onChange({ ...formData, end_date: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="meeting_goal">Meeting Goal</Label>
            <Input
              id="meeting_goal"
              type="number"
              value={formData.meeting_goal}
              onChange={(e) => onChange({ ...formData, meeting_goal: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target_list_size">Target List Size</Label>
            <Input
              id="target_list_size"
              type="number"
              value={formData.target_list_size}
              onChange={(e) => onChange({ ...formData, target_list_size: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      {/* Financial */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">Financial</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthly_retainer">Monthly Retainer ($)</Label>
            <Input
              id="monthly_retainer"
              type="number"
              value={formData.monthly_retainer || ''}
              onChange={(e) => onChange({ 
                ...formData, 
                monthly_retainer: e.target.value ? parseFloat(e.target.value) : null 
              })}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fee_schedule">Fee Schedule</Label>
            <Input
              id="fee_schedule"
              value={formData.fee_schedule}
              onChange={(e) => onChange({ ...formData, fee_schedule: e.target.value })}
              placeholder="e.g., Net 30"
            />
          </div>
        </div>
      </div>

      {/* Team Assignments */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground">Team Assignments</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <TeamMemberSelect
            label="Deal Lead"
            value={formData.deal_lead_id}
            onChange={(v) => onChange({ ...formData, deal_lead_id: v })}
            teamMembers={activeMembers}
          />
          <TeamMemberSelect
            label="Associate/VP"
            value={formData.associate_id}
            onChange={(v) => onChange({ ...formData, associate_id: v })}
            teamMembers={activeMembers}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TeamMemberSelect
            label="Analyst"
            value={formData.analyst_id}
            onChange={(v) => onChange({ ...formData, analyst_id: v })}
            teamMembers={activeMembers}
          />
          <TeamMemberSelect
            label="2nd Analyst"
            value={formData.analyst_2_id}
            onChange={(v) => onChange({ ...formData, analyst_2_id: v })}
            teamMembers={activeMembers}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TeamMemberSelect
            label="Research Lead"
            value={formData.research_lead_id}
            onChange={(v) => onChange({ ...formData, research_lead_id: v })}
            teamMembers={activeMembers}
          />
          <TeamMemberSelect
            label="Research Mid-Level"
            value={formData.research_mid_id}
            onChange={(v) => onChange({ ...formData, research_mid_id: v })}
            teamMembers={activeMembers}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving || !formData.name.trim()}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Update' : 'Create'}
        </Button>
      </div>
    </div>
  );
}
