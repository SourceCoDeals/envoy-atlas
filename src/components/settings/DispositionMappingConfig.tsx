import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Save, RefreshCw, Phone, CheckCircle, MessageSquare, Voicemail, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import type { DispositionMapping } from '@/hooks/useDispositionMappings';

interface Props {
  engagementId: string;
}

export function DispositionMappingConfig({ engagementId }: Props) {
  const queryClient = useQueryClient();
  const [editedMappings, setEditedMappings] = useState<Map<string, Partial<DispositionMapping>>>(new Map());

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['disposition-mappings', engagementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disposition_mappings')
        .select('*')
        .eq('engagement_id', engagementId)
        .order('external_disposition');
      if (error) throw error;
      return data as DispositionMapping[];
    },
    enabled: !!engagementId,
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<DispositionMapping>[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('disposition_mappings')
          .update({
            is_connection: update.is_connection,
            is_conversation: update.is_conversation,
            is_voicemail: update.is_voicemail,
            is_meeting: update.is_meeting,
            is_dm: update.is_dm,
            min_talk_duration_seconds: update.min_talk_duration_seconds,
          })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disposition-mappings', engagementId] });
      setEditedMappings(new Map());
      toast.success('Disposition mappings saved');
    },
    onError: (error) => {
      toast.error('Failed to save: ' + error.message);
    },
  });

  const handleChange = (id: string, field: keyof DispositionMapping, value: any) => {
    setEditedMappings(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(id) || { id };
      newMap.set(id, { ...existing, [field]: value });
      return newMap;
    });
  };

  const getValue = (mapping: DispositionMapping, field: keyof DispositionMapping) => {
    const edited = editedMappings.get(mapping.id);
    if (edited && field in edited) {
      return edited[field];
    }
    return mapping[field];
  };

  const handleSave = () => {
    const updates = Array.from(editedMappings.values());
    if (updates.length === 0) {
      toast.info('No changes to save');
      return;
    }
    saveMutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading disposition mappings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Connection Definitions</CardTitle>
              <CardDescription>
                Configure how PhoneBurner dispositions map to your metrics
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {editedMappings.size > 0 && (
              <Badge variant="secondary">{editedMappings.size} unsaved changes</Badge>
            )}
            <Button
              onClick={handleSave}
              disabled={editedMappings.size === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-4">
          Check the boxes to indicate what each disposition means for your metrics. 
          A "connection" counts toward your connect rate, a "conversation" indicates a quality interaction.
        </div>
        
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Disposition
                  </div>
                </TableHead>
                <TableHead className="text-center w-[100px]">
                  <div className="flex items-center justify-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Connection
                  </div>
                </TableHead>
                <TableHead className="text-center w-[100px]">
                  <div className="flex items-center justify-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    Conversation
                  </div>
                </TableHead>
                <TableHead className="text-center w-[100px]">
                  <div className="flex items-center justify-center gap-1">
                    <Voicemail className="h-4 w-4" />
                    Voicemail
                  </div>
                </TableHead>
                <TableHead className="text-center w-[100px]">
                  <div className="flex items-center justify-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Meeting
                  </div>
                </TableHead>
                <TableHead className="text-center w-[100px]">
                  <div className="flex items-center justify-center gap-1">
                    <User className="h-4 w-4" />
                    DM
                  </div>
                </TableHead>
                <TableHead className="text-center w-[100px]">
                  Min Duration
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings?.map(mapping => (
                <TableRow 
                  key={mapping.id}
                  className={editedMappings.has(mapping.id) ? 'bg-accent/30' : ''}
                >
                  <TableCell className="font-medium">
                    <div>
                      <span className="capitalize">{mapping.external_disposition.replace(/_/g, ' ')}</span>
                      {mapping.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {mapping.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getValue(mapping, 'is_connection') as boolean}
                      onCheckedChange={(checked) => 
                        handleChange(mapping.id, 'is_connection', checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getValue(mapping, 'is_conversation') as boolean}
                      onCheckedChange={(checked) => 
                        handleChange(mapping.id, 'is_conversation', checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getValue(mapping, 'is_voicemail') as boolean}
                      onCheckedChange={(checked) => 
                        handleChange(mapping.id, 'is_voicemail', checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getValue(mapping, 'is_meeting') as boolean}
                      onCheckedChange={(checked) => 
                        handleChange(mapping.id, 'is_meeting', checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={getValue(mapping, 'is_dm') as boolean}
                      onCheckedChange={(checked) => 
                        handleChange(mapping.id, 'is_dm', checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      className="w-16 text-center h-8"
                      value={getValue(mapping, 'min_talk_duration_seconds') as number}
                      onChange={(e) => 
                        handleChange(mapping.id, 'min_talk_duration_seconds', parseInt(e.target.value) || 30)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">How this affects your metrics:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Connection:</strong> Counts toward your Connect Rate (connections ÷ total calls)</li>
            <li>• <strong>Conversation:</strong> Indicates a quality interaction occurred</li>
            <li>• <strong>Voicemail:</strong> Counts toward voicemail rate</li>
            <li>• <strong>Meeting:</strong> Counts toward meeting rate and conversion</li>
            <li>• <strong>DM (Decision Maker):</strong> Indicates you spoke with a decision maker</li>
            <li>• <strong>Min Duration:</strong> Calls with talk time above this also count as connections</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
