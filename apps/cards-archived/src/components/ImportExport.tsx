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
      } catch {
        toast('Failed to import: invalid file', 'error');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h2 className="text-2xl font-extrabold text-gray-800 mb-6">Import / Export</h2>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-1">Export All Trips</h3>
          <p className="text-sm text-gray-400 mb-4">Save your trip data as a JSON file.</p>
          <Button onClick={handleExport} className="rounded-full">
            <Download size={14} /> Export JSON
          </Button>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-1">Import Trips</h3>
          <p className="text-sm text-gray-400 mb-4">Load trips from a previously exported file.</p>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
          <Button variant="secondary" className="rounded-full" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Choose File
          </Button>
        </div>
      </div>
    </div>
  );
}
