import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, TrendingUp, TrendingDown, Minus, Search, 
  MessageSquare, Target, AlertTriangle, Lightbulb, Users,
  Phone, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { useExternalCallIntel } from '@/hooks/useExternalCallIntel';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { getScoreStatus, getScoreStatusColor, formatScore } from '@/lib/callingConfig';
import { cn } from '@/lib/utils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScoreOverviewSection } from '@/components/callinsights/ScoreOverviewSection';
import { ScoreJustificationBrowser } from '@/components/callinsights/ScoreJustificationBrowser';
import { QuestionAdherenceSection } from '@/components/callinsights/QuestionAdherenceSection';
import { ObjectionIntelligence } from '@/components/callinsights/ObjectionIntelligence';
import { ExtractedIntelSummary } from '@/components/callinsights/ExtractedIntelSummary';

export default function CallInsights() {
  const { data, isLoading, error } = useExternalCallIntel();
  const { config } = useCallingConfig();
  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Call Insights</h1>
              <p className="text-muted-foreground">AI-Extracted Intelligence from Calls</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load call insights: {String(error)}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const totalCalls = data?.intelRecords.length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Call Insights</h1>
              <p className="text-muted-foreground">AI-Extracted Intelligence from {totalCalls} Calls</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {totalCalls} calls analyzed
          </Badge>
        </div>

        {/* No Data State */}
        {totalCalls === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Call Intelligence Data Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Call intelligence data will appear here once calls are processed through the AI scoring pipeline.
                This includes score breakdowns, objection handling, and extracted prospect insights.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {totalCalls > 0 && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Score Overview
              </TabsTrigger>
              <TabsTrigger value="justifications" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Justifications
              </TabsTrigger>
              <TabsTrigger value="questions" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Question Adherence
              </TabsTrigger>
              <TabsTrigger value="objections" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Objections
              </TabsTrigger>
              <TabsTrigger value="intel" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Extracted Intel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ScoreOverviewSection data={data} config={config} />
            </TabsContent>

            <TabsContent value="justifications">
              <ScoreJustificationBrowser data={data} config={config} />
            </TabsContent>

            <TabsContent value="questions">
              <QuestionAdherenceSection data={data} config={config} />
            </TabsContent>

            <TabsContent value="objections">
              <ObjectionIntelligence data={data} config={config} />
            </TabsContent>

            <TabsContent value="intel">
              <ExtractedIntelSummary data={data} config={config} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
