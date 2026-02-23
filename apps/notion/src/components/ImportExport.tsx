import React, { useRef } from 'react';
import { Button, toast } from '@trip-planner/ui';
import { Download, Upload } from 'lucide-react';

interface ImportExportProps {
  store: {
    exportData: (tripIds?: string[]) => string;
    importData: (json: string) => number;
  };
}

export function ImportExport({ store }: ImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = store.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip-planner-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Data exported');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const count = store.importData(reader.result as string);
        toast(`Imported ${count} trip(s)`, 'success');
      } catch (err) {
        toast('Failed to import: invalid file', 'error');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Import / Export</h2>

      <div className="flex flex-col gap-4">
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="font-medium text-gray-800 mb-1">Export All Trips</h3>
          <p className="text-sm text-gray-500 mb-3">Download all your trip data as a JSON file.</p>
          <Button onClick={handleExport} size="sm">
            <Download size={14} /> Export JSON
          </Button>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="font-medium text-gray-800 mb-1">Import Trips</h3>
          <p className="text-sm text-gray-500 mb-3">Import trip data from a previously exported JSON file.</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Choose File
          </Button>
        </div>
      </div>
    </div>
  );
}
