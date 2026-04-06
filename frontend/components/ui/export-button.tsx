import { Button } from './button';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  contractId: string;
  type: 'csv' | 'pdf';
  dataType?: 'transactions' | 'wallet-segments' | 'cohort-retention';
  className?: string;
}

export function ExportButton({ contractId, type, dataType, className }: ExportButtonProps) {
  const handleExport = async () => {
    try {
      const url = type === 'csv' 
        ? `/api/analysis/${contractId}/export/csv?type=${dataType}`
        : `/api/analysis/${contractId}/export/pdf`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1] || `export.${type}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <Button
      onClick={handleExport}
      variant="outline"
      size="sm"
      className={className}
    >
      <Download className="h-4 w-4 mr-2" />
      Export {type.toUpperCase()}
    </Button>
  );
}
