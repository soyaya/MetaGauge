'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';

interface FilterState {
  transactionType?: string[]
  status?: string[]
  valueRange?: { min?: number; max?: number }
}

interface AvailableFilters {
  types?: string[]
  statuses?: string[]
}

interface DateRange {
  start: Date | undefined
  end: Date | undefined
}

export function AdvancedFilter({ onFilterChange, availableFilters }: { onFilterChange: (f: unknown) => void; availableFilters: AvailableFilters }) {
  const [filters, setFilters] = useState<FilterState>({});
  const [dateRange, setDateRange] = useState<DateRange>({ start: undefined, end: undefined });

  const applyFilters = () => {
    onFilterChange({ ...filters, dateRange: dateRange.start && dateRange.end ? dateRange : undefined });
  };

  const clearFilters = () => {
    setFilters({});
    setDateRange({ start: undefined, end: undefined });
    onFilterChange({});
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </h3>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Date Range</Label>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.start ? format(dateRange.start, 'PP') : 'Start date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateRange.start}
                onSelect={(date) => setDateRange({ ...dateRange, start: date ?? undefined })}
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.end ? format(dateRange.end, 'PP') : 'End date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateRange.end}
                onSelect={(date) => setDateRange({ ...dateRange, end: date ?? undefined })}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {availableFilters?.types && availableFilters.types.length > 0 && (
        <div className="space-y-2">
          <Label>Transaction Type</Label>
          <Select
            value={filters.transactionType?.[0]}
            onValueChange={(value) => setFilters({ ...filters, transactionType: [value] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {availableFilters.types.map((type: string) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Value Range</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.valueRange?.min ?? ''}
            onChange={(e) => setFilters({ ...filters, valueRange: { ...filters.valueRange, min: parseFloat(e.target.value) } })}
          />
          <Input
            type="number"
            placeholder="Max"
            value={filters.valueRange?.max ?? ''}
            onChange={(e) => setFilters({ ...filters, valueRange: { ...filters.valueRange, max: parseFloat(e.target.value) } })}
          />
        </div>
      </div>

      {availableFilters?.statuses && availableFilters.statuses.length > 0 && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={filters.status?.[0]}
            onValueChange={(value) => setFilters({ ...filters, status: [value] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {availableFilters.statuses.map((status: string) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button onClick={applyFilters} className="w-full">Apply Filters</Button>
    </div>
  );
}
