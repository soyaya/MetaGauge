/**
 * Filter Service
 * Applies filters to transaction and user data
 */

export class FilterService {
  static applyFilters(data, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return data;
    }

    let filtered = [...data];

    // Date range filter
    if (filters.dateRange?.start && filters.dateRange?.end) {
      filtered = filtered.filter(item => {
        const date = new Date(item.timestamp || item.created_at);
        return date >= new Date(filters.dateRange.start) && 
               date <= new Date(filters.dateRange.end);
      });
    }

    // Transaction type filter
    if (filters.transactionType?.length > 0) {
      filtered = filtered.filter(item =>
        filters.transactionType.includes(item.type || item.event_name)
      );
    }

    // Value range filter
    if (filters.valueRange) {
      const { min, max } = filters.valueRange;
      filtered = filtered.filter(item => {
        const value = parseFloat(item.value || 0);
        return value >= (min || 0) && value <= (max || Infinity);
      });
    }

    // Status filter
    if (filters.status?.length > 0) {
      filtered = filtered.filter(item =>
        filters.status.includes(item.status)
      );
    }

    // User segment filter
    if (filters.userSegment?.length > 0) {
      filtered = filtered.filter(item =>
        filters.userSegment.includes(item.segment || item.user_segment)
      );
    }

    return filtered;
  }

  static getAvailableFilters(data) {
    const types = new Set();
    const statuses = new Set();
    let minValue = Infinity;
    let maxValue = 0;
    let minDate = null;
    let maxDate = null;

    data.forEach(item => {
      if (item.type || item.event_name) types.add(item.type || item.event_name);
      if (item.status) statuses.add(item.status);
      
      const value = parseFloat(item.value || 0);
      if (value > 0) {
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }

      const date = new Date(item.timestamp || item.created_at);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    });

    return {
      types: Array.from(types),
      statuses: Array.from(statuses),
      valueRange: { min: minValue === Infinity ? 0 : minValue, max: maxValue },
      dateRange: { min: minDate, max: maxDate }
    };
  }
}
