import { useState, useMemo, useCallback } from 'react';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface UseCampaignTableSortOptions<T> {
  defaultField?: keyof T | string;
  defaultDirection?: 'asc' | 'desc';
}

/**
 * Custom hook for sorting campaign table data
 * Handles string, number, date, and null values gracefully
 */
export function useCampaignTableSort<T extends Record<string, any>>(
  data: T[],
  options: UseCampaignTableSortOptions<T> = {}
) {
  const { defaultField = 'name', defaultDirection = 'asc' } = options;
  
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: defaultField as string,
    direction: defaultDirection,
  });

  const handleSort = useCallback((field: string) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const sorted = [...data];
    
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.field];
      const bVal = b[sortConfig.field];
      
      // Handle null/undefined - push to end
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Date comparison
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortConfig.direction === 'asc'
          ? aVal.getTime() - bVal.getTime()
          : bVal.getTime() - aVal.getTime();
      }
      
      // String date comparison (ISO format)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        // Check if both look like dates
        const aDate = Date.parse(aVal);
        const bDate = Date.parse(bVal);
        
        if (!isNaN(aDate) && !isNaN(bDate) && 
            (aVal.includes('-') || aVal.includes('/')) &&
            (bVal.includes('-') || bVal.includes('/'))) {
          return sortConfig.direction === 'asc'
            ? aDate - bDate
            : bDate - aDate;
        }
        
        // Regular string comparison
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
          : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
      }
      
      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      }
      
      // Boolean comparison (true > false)
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        const aNum = aVal ? 1 : 0;
        const bNum = bVal ? 1 : 0;
        return sortConfig.direction === 'asc'
          ? aNum - bNum
          : bNum - aNum;
      }
      
      // Fallback: convert to string and compare
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    
    return sorted;
  }, [data, sortConfig]);

  const resetSort = useCallback(() => {
    setSortConfig({
      field: defaultField as string,
      direction: defaultDirection,
    });
  }, [defaultField, defaultDirection]);

  return { 
    sortedData, 
    sortConfig, 
    handleSort, 
    resetSort,
    setSortConfig,
  };
}
