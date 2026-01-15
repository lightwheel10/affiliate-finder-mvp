'use client';

/**
 * ExportButton.tsx
 * i18n Migration: January 10th, 2026 - Phase 3: Toast Notifications
 * 
 * Component for exporting data to CSV format.
 * All toast notifications have been migrated to use the translation dictionary.
 */

import { useState } from 'react';
import { toast } from 'sonner'; // January 5th, 2026: Global toast notifications
import { Download, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Admin UI refresh (neo-brutalist, light-only) - January 15th, 2026
// Export button restyled for the high-contrast admin theme.
// Polish pass (consistent weight + spacing) - January 15th, 2026

interface ExportButtonProps {
  endpoint: string;
  filename: string;
  params?: Record<string, string>;
}

export function ExportButton({ endpoint, filename, params = {} }: ExportButtonProps) {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
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
      // i18n: January 10th, 2026
      toast.success(t.toasts.success.csvExported);
    } catch (error) {
      console.error('Export error:', error);
      // January 5th, 2026: Replaced alert() with Sonner toast
      // i18n: January 10th, 2026
      toast.error(t.toasts.error.exportFailed);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-sm font-bold uppercase text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50"
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
