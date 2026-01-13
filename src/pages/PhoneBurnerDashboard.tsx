import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePhoneBurnerData } from '@/hooks/usePhoneBurnerData';
import { PhoneBurnerFilters } from '@/components/phoneburner/PhoneBurnerFilters';
import { SummaryCards } from '@/components/phoneburner/SummaryCards';
import { CategoryBreakdown } from '@/components/phoneburner/CategoryBreakdown';
import { CallsByAnalystChart } from '@/components/phoneburner/CallsByAnalystChart';
import { CallTimeScatterChart } from '@/components/phoneburner/CallTimeScatterChart';
import { OpportunityChart } from '@/components/phoneburner/OpportunityChart';
import { DurationCharts } from '@/components/phoneburner/DurationCharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone } from 'lucide-react';

export default function PhoneBurnerDashboard() {
  const {
    filters,
    setFilters,
    filterOptions,
    filteredCalls,
    summary,
    categoryBreakdown,
    callsByAnalystOverTime,
    uniqueAnalysts,
    scatterData,
    callsByOpportunity,
    durationDistribution,
    durationTrends,
    isLoading,
  } = usePhoneBurnerData();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Phone className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Phone Burner Dashboard</h1>
              <p className="text-muted-foreground">Loading call data...</p>
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Phone className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Phone Burner Dashboard</h1>
            <p className="text-muted-foreground">
              Analyze call performance from NocoDB/PhoneBurner data • {filteredCalls.length.toLocaleString()} calls matching filters
            </p>
          </div>
        </div>

        {/* Filters */}
        <PhoneBurnerFilters 
          filters={filters} 
          setFilters={setFilters} 
          filterOptions={filterOptions} 
        />

        {/* Summary Cards */}
        <SummaryCards 
          totalCalls={summary.totalCalls}
          avgDuration={summary.avgDuration}
          totalDuration={summary.totalDuration}
        />

        {/* Category Breakdown */}
        <CategoryBreakdown 
          data={categoryBreakdown} 
          totalCalls={summary.totalCalls} 
        />

        {/* Calls by Analyst Over Time */}
        <CallsByAnalystChart 
          data={callsByAnalystOverTime} 
          analysts={uniqueAnalysts} 
        />

        {/* Scatter Chart - Time of Day Distribution */}
        <CallTimeScatterChart 
          data={scatterData} 
          analysts={uniqueAnalysts} 
        />

        {/* Calls by Primary Opportunity */}
        <OpportunityChart data={callsByOpportunity} />

        {/* Duration Charts */}
        <DurationCharts 
          durationDistribution={durationDistribution}
          durationTrends={durationTrends}
        />
      </div>
    </DashboardLayout>
  );
}
