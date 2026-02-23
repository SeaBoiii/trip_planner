import React, { useRef } from 'react';
import type { AppState } from '@trip-planner/core';
import { getAttachmentRecordsByIds, saveAttachmentRecord } from '@trip-planner/core';
import { Button, toast } from '@trip-planner/ui';
import JSZip from 'jszip';
import { Download, Package, Upload } from 'lucide-react';

interface ImportExportProps {
  store: {
    state: AppState;
    exportData: (tripIds?: string[]) => string;
    importData: (json: string) => number;
  };
  embedded?: boolean;
}

function collectAttachmentIds(state: AppState): string[] {
  const ids = new Set<string>();
  for (const trip of state.trips) {
    for (const day of trip.days) {
      for (const item of day.items) {
        for (const attachment of item.attachments ?? []) {
          ids.add(attachment.id);
        }
      }
    }
  }
  return Array.from(ids);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ImportExport({ store, embedded = false }: ImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExportJson = () => {
    const json = store.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `trip-planner-export-${new Date().toISOString().split('T')[0]}.json`);
    toast('Data exported');
  };

  const handleExportZip = async () => {
    try {
      const json = store.exportData();
      const zip = new JSZip();
      zip.file('trip.json', json);

      const attachmentIds = collectAttachmentIds(store.state);
      const records = await getAttachmentRecordsByIds(attachmentIds);
      const attachmentsFolder = zip.folder('attachments');
      if (attachmentsFolder) {
        for (const record of records) {
          attachmentsFolder.file(`${record.meta.id}.meta.json`, JSON.stringify(record.meta, null, 2));
          attachmentsFolder.file(`${record.meta.id}.thumb`, record.thumbBlob);
          attachmentsFolder.file(`${record.meta.id}.full`, record.fullBlob);
        }
      }

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      downloadBlob(blob, `trip-planner-export-${new Date().toISOString().split('T')[0]}.zip`);
      toast(`ZIP exported${records.length ? ` (${records.length} attachments)` : ''}`);
    } catch (error) {
      console.error(error);
      toast('Failed to export ZIP', 'error');
    }
  };

  const importJson = (json: string) => {
    const count = store.importData(json);
    toast(`Imported ${count} trip(s)`, 'success');
  };

  const importZip = async (file: File) => {
    const zip = await JSZip.loadAsync(file);
    const tripFile = zip.file('trip.json') ?? zip.file('trips.json');
    if (!tripFile) {
      throw new Error('ZIP missing trip.json');
    }

    const json = await tripFile.async('string');
    const count = store.importData(json);

    const attachmentFiles = zip.folder('attachments');
    if (attachmentFiles) {
      const metas = Object.values(attachmentFiles.files).filter((entry) => entry.name.endsWith('.meta.json'));
      for (const metaFile of metas) {
        const id = metaFile.name.split('/').pop()?.replace(/\.meta\.json$/, '');
        if (!id) continue;
        const meta = JSON.parse(await metaFile.async('string'));
        const thumbFile = zip.file(`attachments/${id}.thumb`);
        const fullFile = zip.file(`attachments/${id}.full`);
        if (!thumbFile || !fullFile) continue;
        const [thumbBlob, fullBlob] = await Promise.all([thumbFile.async('blob'), fullFile.async('blob')]);
        await saveAttachmentRecord({ meta, thumbBlob, fullBlob });
      }
    }

    toast(`Imported ${count} trip(s) from ZIP`, 'success');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cleanup = () => {
      if (fileRef.current) fileRef.current.value = '';
    };

    if (file.name.toLowerCase().endsWith('.zip')) {
      importZip(file)
        .catch((error) => {
          console.error(error);
          toast('Failed to import ZIP', 'error');
        })
        .finally(cleanup);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        importJson(reader.result as string);
      } catch (error) {
        console.error(error);
        toast('Failed to import: invalid file', 'error');
      } finally {
        cleanup();
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={embedded ? 'w-full' : 'max-w-lg mx-auto px-4 py-8'}>
      {!embedded && <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Import / Export</h2>}

      <div className="flex flex-col gap-4">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Export All Trips (JSON)</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Download trip data only. Attachments are not included.
          </p>
          <Button onClick={handleExportJson} size="sm">
            <Download size={14} /> Export JSON
          </Button>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Export All Trips + Attachments (ZIP)</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Includes `trip.json` plus compressed image blobs stored in IndexedDB.
          </p>
          <Button onClick={() => { void handleExportZip(); }} size="sm" variant="secondary">
            <Package size={14} /> Export ZIP
          </Button>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Import Trips</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Import a JSON export or ZIP export (with attachments) from this app.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Choose JSON or ZIP
          </Button>
        </div>
      </div>
    </div>
  );
}
