'use client';

import { useState } from 'react';
import { toast } from 'sonner'; // January 5th, 2026: Global toast notifications
import { Download, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  endpoint: string;
  filename: string;
  params?: Record<string, string>;
}

export function ExportButton({ endpoint, filename, params = {} }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Build query string with format=csv
      const queryParams = new URLSearchParams({ ...params, format: 'csv' });
      const url = `${endpoint}?${queryParams.toString()}`;
      
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Export failed');
      }

      // Get the CSV content
      const blob = await res.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      // January 5th, 2026: Show success toast after download
      toast.success('CSV exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      // January 5th, 2026: Replaced alert() with Sonner toast
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 px-4 py-2 bg-[#23272B] rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#2E3338] transition-colors disabled:opacity-50"
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      Export CSV
    </button>
  );
}
