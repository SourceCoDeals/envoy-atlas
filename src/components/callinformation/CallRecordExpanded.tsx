import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronUp, Phone, Calendar, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

interface CallRecord {
  id: string;
  callId: string;
  contactName: string;
  companyName: string;
  callCategory: string;
  interestLevel: string;
  sellerInterestScore: number;
  overallQualityScore: number;
  timeline: string;
  objections: string[];
  summary: string;
  followupTask: string | null;
  followupDueDate: string | null;
  isFollowupCompleted: boolean;
  createdAt: string;
}

interface CallRecordExpandedProps {
  records: CallRecord[];
  onMarkFollowupComplete?: (recordId: string) => void;
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-500';
  if (score >= 6) return 'text-yellow-500';
  if (score >= 4) return 'text-orange-500';
  return 'text-red-500';
}

function getCategoryBadge(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes('connection')) return <Badge className="bg-green-500/10 text-green-500">Connection</Badge>;
  if (cat.includes('gatekeeper')) return <Badge className="bg-yellow-500/10 text-yellow-500">Gatekeeper</Badge>;
  if (cat.includes('voicemail')) return <Badge className="bg-muted text-muted-foreground">Voicemail</Badge>;
  return <Badge variant="outline">{category}</Badge>;
}

export function CallRecordExpanded({ records, onMarkFollowupComplete }: CallRecordExpandedProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No call records found</p>
            <p className="text-sm mt-1">Scored calls will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Individual Call Records ({records.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <>
                  <TableRow 
                    key={record.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleRow(record.id)}
                  >
                    <TableCell>
                      {expandedRows.has(record.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{record.contactName}</TableCell>
                    <TableCell>{getCategoryBadge(record.callCategory)}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${getScoreColor(record.sellerInterestScore)}`}>
                        {record.sellerInterestScore}/10
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${getScoreColor(record.overallQualityScore)}`}>
                        {record.overallQualityScore}/10
                      </span>
                    </TableCell>
                    <TableCell>{record.timeline}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(record.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                  
                  {expandedRows.has(record.id) && (
                    <TableRow key={`${record.id}-expanded`}>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <div className="p-4 space-y-4">
                          {record.summary && (
                            <div>
                              <p className="text-sm font-medium mb-1">Summary</p>
                              <p className="text-sm text-muted-foreground">{record.summary}</p>
                            </div>
                          )}

                          {record.objections.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">Objections Raised</p>
                              <div className="flex flex-wrap gap-2">
                                {record.objections.map((obj, i) => (
                                  <Badge key={i} variant="outline">{obj}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {record.followupTask && (
                            <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                              <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{record.followupTask}</p>
                                  {record.followupDueDate && (
                                    <p className="text-xs text-muted-foreground">
                                      Due: {format(new Date(record.followupDueDate), 'MMM d, yyyy')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {!record.isFollowupCompleted && onMarkFollowupComplete && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkFollowupComplete(record.id);
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Mark Complete
                                </Button>
                              )}
                              {record.isFollowupCompleted && (
                                <Badge className="bg-green-500/10 text-green-500">Completed</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
