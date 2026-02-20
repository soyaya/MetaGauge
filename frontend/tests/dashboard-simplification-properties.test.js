/**
 * Dashboard Simplification Property Tests
 * 
 * Property-based tests for dashboard simplification feature
 * Feature: dashboard-simplification, Property 1: Direct Table Display
 */

const fs = require('fs');
const path = require('path');

describe('Dashboard Simplification Property Tests', () => {
  
  /**
   * Property 1: Direct Table Display
   * For any dashboard page load, the projects table should be immediately visible without requiring tab navigation
   * Validates: Requirements 1.1
   */
  describe('Property 1: Direct Table Display', () => {
    test('Dashboard page should render ProjectsTable directly without tabs', () => {
      // Read the dashboard page source code
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Dashboard should not contain tab-related components
      expect(dashboardContent).not.toContain('Tabs');
      expect(dashboardContent).not.toContain('TabsList');
      expect(dashboardContent).not.toContain('TabsContent');
      expect(dashboardContent).not.toContain('TabsTrigger');
      
      // Property: Dashboard should directly render ProjectsTable
      expect(dashboardContent).toContain('ProjectsTable');
      expect(dashboardContent).toContain('sidebarFilters={filters}');
      
      // Property: Dashboard should preserve header and badge
      expect(dashboardContent).toContain('DashboardHeader');
      expect(dashboardContent).toContain('Badge');
      expect(dashboardContent).toContain('Top Web3 Project');
      expect(dashboardContent).toContain('Real time analysis across chain');
      
      // Property: Dashboard should maintain WebSocket functionality
      expect(dashboardContent).toContain('useWebSocket');
      expect(dashboardContent).toContain('isConnected');
      
      // Property: Dashboard should maintain filter functionality
      expect(dashboardContent).toContain('useDashboardFilters');
      expect(dashboardContent).toContain('filters');
    });

    test('Dashboard page should not import removed components', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should not import tab-related components
      expect(dashboardContent).not.toContain('import.*Tabs.*from');
      expect(dashboardContent).not.toContain('import.*TabsList.*from');
      expect(dashboardContent).not.toContain('import.*TabsContent.*from');
      expect(dashboardContent).not.toContain('import.*TabsTrigger.*from');
      
      // Property: Should not import removed dashboard components
      expect(dashboardContent).not.toContain('import.*MetricsCards.*from');
      expect(dashboardContent).not.toContain('import.*TrendCharts.*from');
      expect(dashboardContent).not.toContain('import.*CompetitiveAnalysis.*from');
      
      // Property: Should maintain required imports
      expect(dashboardContent).toContain('import { DashboardHeader }');
      expect(dashboardContent).toContain('import { ProjectsTable }');
      expect(dashboardContent).toContain('import { useDashboardFilters }');
      expect(dashboardContent).toContain('import { useWebSocket }');
      expect(dashboardContent).toContain('import { Badge }');
    });

    test('Dashboard page should maintain proper JSX structure', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should have proper container structure
      expect(dashboardContent).toContain('className="flex flex-col h-full"');
      expect(dashboardContent).toContain('className="p-6 pb-0"');
      expect(dashboardContent).toContain('className="flex-1 p-6 overflow-y-auto"');
      
      // Property: Should have header section with title and badge
      expect(dashboardContent).toContain('className="flex items-center justify-between"');
      expect(dashboardContent).toContain('showFilters');
      expect(dashboardContent).toContain('className="ml-4"');
      
      // Property: ProjectsTable should be in the main content area
      const projectsTableMatch = dashboardContent.match(/<ProjectsTable[^>]*>/);
      expect(projectsTableMatch).toBeTruthy();
      
      // Property: ProjectsTable should receive sidebarFilters prop
      expect(dashboardContent).toContain('<ProjectsTable sidebarFilters={filters}');
    });

    test('Dashboard page should preserve all required functionality', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should use dashboard filters hook
      expect(dashboardContent).toContain('const { filters } = useDashboardFilters()');
      
      // Property: Should use WebSocket hook
      expect(dashboardContent).toContain('const { isConnected } = useWebSocket()');
      
      // Property: Should pass filters to ProjectsTable
      expect(dashboardContent).toContain('sidebarFilters={filters}');
      
      // Property: Should show connection status
      expect(dashboardContent).toContain('variant={isConnected ? "default" : "secondary"}');
      expect(dashboardContent).toContain('{isConnected ? "🟢 Live" : "🔴 Offline"}');
      
      // Property: Should maintain proper component export
      expect(dashboardContent).toContain('export default function DashboardPage()');
    });

    test('Dashboard page should have clean code structure', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should have "use client" directive
      expect(dashboardContent).toContain('"use client"');
      
      // Property: Should not have unused variables or constants
      const lines = dashboardContent.split('\n');
      const importLines = lines.filter(line => line.trim().startsWith('import'));
      const usageLines = lines.filter(line => !line.trim().startsWith('import') && !line.trim().startsWith('//'));
      const usageContent = usageLines.join('\n');
      
      // Check that all imported components are used
      importLines.forEach(importLine => {
        if (importLine.includes('DashboardHeader')) {
          expect(usageContent).toContain('DashboardHeader');
        }
        if (importLine.includes('ProjectsTable')) {
          expect(usageContent).toContain('ProjectsTable');
        }
        if (importLine.includes('Badge')) {
          expect(usageContent).toContain('Badge');
        }
        if (importLine.includes('useDashboardFilters')) {
          expect(usageContent).toContain('useDashboardFilters');
        }
        if (importLine.includes('useWebSocket')) {
          expect(usageContent).toContain('useWebSocket');
        }
      });
      
      // Property: Should not contain commented out code or unused imports
      expect(dashboardContent).not.toContain('// TODO');
      expect(dashboardContent).not.toContain('/* TODO');
    });
  });

  /**
   * Property 4: Layout Structure Preservation
   * For any dashboard page, the layout structure should maintain proper spacing, responsive design, and visual hierarchy
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  describe('Property 4: Layout Structure Preservation', () => {
    test('Dashboard should maintain proper container structure and spacing', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should maintain main container with full height
      expect(dashboardContent).toContain('className="flex flex-col h-full"');
      
      // Property: Should maintain header section with proper padding
      expect(dashboardContent).toContain('className="p-6 pb-0"');
      
      // Property: Should maintain main content area with proper padding and overflow
      expect(dashboardContent).toContain('className="flex-1 p-6 overflow-y-auto"');
      
      // Property: Should maintain header layout with space between elements
      expect(dashboardContent).toContain('className="flex items-center justify-between"');
      
      // Property: Should maintain badge spacing
      expect(dashboardContent).toContain('className="ml-4"');
    });

    test('Dashboard should preserve responsive design structure', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should use flex layout for responsive behavior
      expect(dashboardContent).toContain('flex flex-col');
      expect(dashboardContent).toContain('flex items-center');
      expect(dashboardContent).toContain('flex-1');
      
      // Property: Should maintain proper overflow handling
      expect(dashboardContent).toContain('overflow-y-auto');
      
      // Property: Should maintain full height container
      expect(dashboardContent).toContain('h-full');
    });

    test('Dashboard should maintain visual hierarchy and spacing', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should maintain consistent padding system
      const paddingClasses = dashboardContent.match(/p-\d+/g) || [];
      expect(paddingClasses).toContain('p-6');
      
      // Property: Should maintain proper content separation
      expect(dashboardContent).toContain('pb-0'); // Header bottom padding removal
      
      // Property: Should maintain proper element spacing
      expect(dashboardContent).toContain('ml-4'); // Badge left margin
    });

    test('Dashboard layout should work with sidebar integration', () => {
      const layoutPath = path.join(__dirname, '../app/dashboard/layout.tsx');
      expect(fs.existsSync(layoutPath)).toBe(true);
      
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      
      // Property: Layout should provide dashboard filters context
      expect(layoutContent).toContain('useDashboardFilters');
      
      // Property: Layout should maintain sidebar structure
      // The layout file should handle the sidebar integration
      expect(layoutContent).toContain('DashboardFiltersProvider');
    });
  });

  /**
   * Property 5: Header and Badge Preservation
   * For any dashboard page, the header and WebSocket badge should maintain their styling and positioning
   * Validates: Requirements 1.3, 3.4
   */
  describe('Property 5: Header and Badge Preservation', () => {
    test('Dashboard should preserve header component and styling', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should maintain DashboardHeader component
      expect(dashboardContent).toContain('<DashboardHeader');
      
      // Property: Should preserve header title and subtitle
      expect(dashboardContent).toContain('title="Top Web3 Project"');
      expect(dashboardContent).toContain('subtitle="Real time analysis across chain"');
      
      // Property: Should maintain showFilters prop
      expect(dashboardContent).toContain('showFilters');
      
      // Property: Header should be in the correct position (before main content)
      const headerIndex = dashboardContent.indexOf('<DashboardHeader');
      const tableIndex = dashboardContent.indexOf('<ProjectsTable');
      expect(headerIndex).toBeLessThan(tableIndex);
    });

    test('Dashboard should preserve WebSocket badge styling and positioning', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should maintain Badge component
      expect(dashboardContent).toContain('<Badge');
      
      // Property: Should preserve badge variant logic
      expect(dashboardContent).toContain('variant={isConnected ? "default" : "secondary"}');
      
      // Property: Should maintain badge positioning class
      expect(dashboardContent).toContain('className="ml-4"');
      
      // Property: Should preserve connection status text
      expect(dashboardContent).toContain('{isConnected ? "🟢 Live" : "🔴 Offline"}');
      
      // Property: Badge should be positioned next to header
      const headerSection = dashboardContent.match(/<div className="flex items-center justify-between">[\s\S]*?<\/div>/);
      expect(headerSection).toBeTruthy();
      expect(headerSection[0]).toContain('DashboardHeader');
      expect(headerSection[0]).toContain('Badge');
    });

    test('Dashboard should maintain proper header-badge relationship', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Header and badge should be in the same flex container
      const flexContainer = dashboardContent.match(/<div className="flex items-center justify-between">([\s\S]*?)<\/div>/);
      expect(flexContainer).toBeTruthy();
      
      const containerContent = flexContainer[1];
      expect(containerContent).toContain('DashboardHeader');
      expect(containerContent).toContain('Badge');
      
      // Property: Should maintain space-between layout
      expect(dashboardContent).toContain('justify-between');
      
      // Property: Should maintain center alignment
      expect(dashboardContent).toContain('items-center');
    });

    test('Dashboard should preserve WebSocket functionality integration', () => {
      const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Property: Should import and use WebSocket hook
      expect(dashboardContent).toContain('import { useWebSocket }');
      expect(dashboardContent).toContain('const { isConnected } = useWebSocket()');
      
      // Property: Should use isConnected state in badge
      expect(dashboardContent).toContain('isConnected ?');
      
      // Property: Should maintain proper hook usage pattern
      const hookUsage = dashboardContent.match(/const { isConnected } = useWebSocket\(\)/);
      expect(hookUsage).toBeTruthy();
    });
  });

  /**
   * Integration validation tests
   */
  describe('Integration Validation', () => {
    test('Required component files should exist', () => {
      // Property: All referenced components should exist
      const componentsToCheck = [
        '../components/dashboard/header.tsx',
        '../components/dashboard/projects-table.tsx',
        '../components/ui/badge.tsx'
      ];
      
      componentsToCheck.forEach(componentPath => {
        const fullPath = path.join(__dirname, componentPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });

    test('Layout file should exist and export useDashboardFilters', () => {
      const layoutPath = path.join(__dirname, '../app/dashboard/layout.tsx');
      expect(fs.existsSync(layoutPath)).toBe(true);
      
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      expect(layoutContent).toContain('useDashboardFilters');
    });

    test('WebSocket hook should exist', () => {
      const hookPath = path.join(__dirname, '../hooks/use-websocket.tsx');
      const altHookPath = path.join(__dirname, '../hooks/use-websocket.ts');
      
      const hookExists = fs.existsSync(hookPath) || fs.existsSync(altHookPath);
      expect(hookExists).toBe(true);
    });
  });
});

/**
 * Test Configuration Notes:
 * 
 * These property tests validate:
 * 1. Dashboard renders ProjectsTable directly without tab navigation
 * 2. All tab-related components and imports are removed
 * 3. Required functionality (filters, WebSocket, header) is preserved
 * 4. Code structure is clean and maintainable
 * 5. All referenced components and hooks exist
 * 
 * The tests use static analysis of the source code to verify
 * the implementation meets the requirements without needing
 * a full React testing environment.
 */