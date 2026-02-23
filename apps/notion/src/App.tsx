import React, { useState } from 'react';
import { useTripStore } from '@trip-planner/core';
import { ToastContainer } from '@trip-planner/ui';
import { TripList } from './components/TripList';
import { Itinerary } from './components/Itinerary';
import { BudgetView } from './components/BudgetView';
import { PrintView } from './components/PrintView';
import { ImportExport } from './components/ImportExport';
import { useTheme } from './hooks/useTheme';
import { Map, CalendarDays, DollarSign, Printer, FolderDown } from 'lucide-react';

type Tab = 'trips' | 'itinerary' | 'budget' | 'print' | 'io';

export function App() {
  const store = useTripStore();
  const [tab, setTab] = useState<Tab>('trips');
  const [showPrint, setShowPrint] = useState(false);

  // Apply theme
  useTheme(store.state.settings.theme);

  // Auto-switch to itinerary when a trip is selected
  const handleSelectTrip = (tripId: string) => {
    store.setActiveTrip(tripId);
    setTab('itinerary');
  };

  if (showPrint && store.activeTrip) {
    return <PrintView trip={store.activeTrip} onClose={() => setShowPrint(false)} />;
  }

  return (
    <div className="flex flex-col h-[100dvh] sm:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Map size={20} className="text-blue-600" />
            Trip Planner
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <TripList
            trips={store.state.trips}
            activeTripId={store.state.activeTripId}
            onSelect={handleSelectTrip}
            onCreate={store.createTrip}
            onDelete={store.deleteTrip}
            onDuplicate={store.duplicateTrip}
            onSaveAsTemplate={store.saveAsTemplate}
            templates={store.state.templates}
            onCreateFromTemplate={store.createTripFromTemplate}
            onDeleteTemplate={store.deleteTemplate}
          />
        </nav>
        <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-1">
          <SidebarButton icon={<DollarSign size={16} />} label="Budget" active={tab === 'budget'} onClick={() => setTab('budget')} />
          <SidebarButton icon={<Printer size={16} />} label="Print" onClick={() => setShowPrint(true)} />
          <SidebarButton icon={<FolderDown size={16} />} label="Import/Export" active={tab === 'io'} onClick={() => setTab('io')} />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 sm:pb-0 bg-gray-50 dark:bg-gray-900">
        {tab === 'trips' && (
          <div className="sm:hidden">
            <div className="px-4 pt-4 pb-2">
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Map size={22} className="text-blue-600" />
                Trip Planner
              </h1>
            </div>
            <TripList
              trips={store.state.trips}
              activeTripId={store.state.activeTripId}
              onSelect={handleSelectTrip}
              onCreate={store.createTrip}
              onDelete={store.deleteTrip}
              onDuplicate={store.duplicateTrip}
              onSaveAsTemplate={store.saveAsTemplate}
              templates={store.state.templates}
              onCreateFromTemplate={store.createTripFromTemplate}
              onDeleteTemplate={store.deleteTemplate}
            />
          </div>
        )}
        {tab === 'itinerary' && store.activeTrip && (
          <Itinerary trip={store.activeTrip} store={store} />
        )}
        {tab === 'itinerary' && !store.activeTrip && (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
            Select or create a trip to get started
          </div>
        )}
        {tab === 'budget' && store.activeTrip && (
          <BudgetView trip={store.activeTrip} />
        )}
        {tab === 'budget' && !store.activeTrip && (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
            Select a trip to view budget
          </div>
        )}
        {tab === 'io' && (
          <ImportExport store={store} />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <MobileTab icon={<Map size={20} />} label="Trips" active={tab === 'trips'} onClick={() => setTab('trips')} />
        <MobileTab icon={<CalendarDays size={20} />} label="Itinerary" active={tab === 'itinerary'} onClick={() => setTab('itinerary')} />
        <MobileTab icon={<DollarSign size={20} />} label="Budget" active={tab === 'budget'} onClick={() => setTab('budget')} />
        <MobileTab icon={<Printer size={20} />} label="Print" active={false} onClick={() => setShowPrint(true)} />
        <MobileTab icon={<FolderDown size={20} />} label="I/O" active={tab === 'io'} onClick={() => setTab('io')} />
      </nav>

      <ToastContainer />
    </div>
  );
}

function MobileTab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
        active ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SidebarButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors w-full text-left ${
        active ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
