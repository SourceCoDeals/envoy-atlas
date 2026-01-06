import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth } from 'date-fns';
import { useMonthlyReportData } from '@/hooks/useMonthlyReportData';
import { ExecutiveSummary } from '@/components/reports/ExecutiveSummary';
import { MonthlyKPICards } from '@/components/reports/MonthlyKPICards';
import { InfrastructureHealth } from '@/components/reports/InfrastructureHealth';
import { MonthlyTrendChart } from '@/components/reports/MonthlyTrendChart';
import { CampaignPerformanceTable } from '@/components/reports/CampaignPerformanceTable';
import { WeeklyBreakdown } from '@/components/reports/WeeklyBreakdown';
import { BenchmarkComparison } from '@/components/reports/BenchmarkComparison';

export default function MonthlyReport() {
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  
  const {
    currentMetrics,
    previousMetrics,
    weeklyBreakdown,
    campaignPerformance,
    infrastructure,
    dailyTrends,
    loading,
    hasData
  } = useMonthlyReportData(selectedMonth);

  const handlePreviousMonth = () => {
    setSelectedMonth(subMonths(selectedMonth, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(selectedMonth, 1);
    if (nextMonth <= new Date()) {
      setSelectedMonth(nextMonth);
    }
  };

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  // Generate month options for last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
      date: startOfMonth(date)
    };
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-40" />
          </div>
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Monthly Report</h1>
            <p className="text-muted-foreground">
              Comprehensive performance overview for {format(selectedMonth, 'MMMM yyyy')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handlePreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Select
              value={format(selectedMonth, 'yyyy-MM')}
              onValueChange={(value) => {
                const option = monthOptions.find(o => o.value === value);
                if (option) setSelectedMonth(option.date);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button variant="outline" className="ml-2">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No data for {format(selectedMonth, 'MMMM yyyy')}</h3>
            <p className="text-muted-foreground mt-1">
              Try selecting a different month or sync your data sources.
            </p>
          </div>
        ) : (
          <>
            {/* Executive Summary */}
            <ExecutiveSummary 
              selectedMonth={selectedMonth}
              currentMetrics={currentMetrics}
              previousMetrics={previousMetrics}
            />

            {/* KPI Cards */}
            <MonthlyKPICards 
              currentMetrics={currentMetrics}
              previousMetrics={previousMetrics}
            />

            {/* Infrastructure Health */}
            <InfrastructureHealth 
              infrastructure={infrastructure}
              currentMetrics={currentMetrics}
            />

            {/* Daily Trend Chart */}
            <MonthlyTrendChart dailyTrends={dailyTrends} />

            {/* Campaign Performance & Benchmarks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <CampaignPerformanceTable campaigns={campaignPerformance} />
              </div>
              <div>
                <BenchmarkComparison currentMetrics={currentMetrics} />
              </div>
            </div>

            {/* Weekly Breakdown */}
            <WeeklyBreakdown weeklyData={weeklyBreakdown} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
