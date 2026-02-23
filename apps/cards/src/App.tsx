import React, { useState } from 'react';
import { useTripStore } from '@trip-planner/core';
import { ToastContainer } from '@trip-planner/ui';
import { TripGallery } from './components/TripGallery';
import { TripDetail } from './components/TripDetail';
import { BudgetView } from './components/BudgetView';
import { PrintView } from './components/PrintView';
import { ImportExport } from './components/ImportExport';
import { Plane, CalendarDays, DollarSign, Printer, FolderDown } from 'lucide-react';

type View = 'trips' | 'detail' | 'budget' | 'print' | 'io';

export function App() {
  const store = useTripStore();
  const [view, setView] = useState<View>('trips');

  const handleSelectTrip = (tripId: string) => {
    store.setActiveTrip(tripId);
    setView('detail');
  };

  if (view === 'print' && store.activeTrip) {
    return <PrintView trip={store.activeTrip} onClose={() => setView('detail')} />;
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Desktop top bar */}
      <header className="hidden sm:flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-md border-b border-sky-100 sticky top-0 z-30">
        <h1 className="text-lg font-extrabold text-sky-700 flex items-center gap-2">
          <Plane size={22} className="text-sky-500" />
          Trip Planner
        </h1>
        <nav className="flex gap-1">
          <TopNavBtn label="Trips" active={view === 'trips'} onClick={() => setView('trips')} />
          <TopNavBtn label="Itinerary" active={view === 'detail'} onClick={() => setView('detail')} />
          <TopNavBtn label="Budget" active={view === 'budget'} onClick={() => setView('budget')} />
          <TopNavBtn label="Print" active={false} onClick={() => setView('print')} />
          <TopNavBtn label="Import/Export" active={view === 'io'} onClick={() => setView('io')} />
        </nav>
      </header>

      {/* Mobile header */}
      <header className="sm:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-sky-100 px-4 py-3">
        <h1 className="text-lg font-extrabold text-sky-700 flex items-center gap-2">
          <Plane size={22} className="text-sky-500" />
          Trip Planner
        </h1>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 sm:pb-4">
        {view === 'trips' && (
          <TripGallery
            trips={store.state.trips}
            onSelect={handleSelectTrip}
            onCreate={store.createTrip}
            onDelete={store.deleteTrip}
            onDuplicate={store.duplicateTrip}
            onUpdateCover={(tripId, url) => store.updateTrip(tripId, { coverPhoto: url })}
          />
        )}
        {view === 'detail' && store.activeTrip && (
          <TripDetail trip={store.activeTrip} store={store} />
        )}
        {view === 'detail' && !store.activeTrip && (
          <div className="flex items-center justify-center h-64 text-sky-400 text-sm">
            Select or create a trip first
          </div>
        )}
        {view === 'budget' && store.activeTrip && (
          <BudgetView trip={store.activeTrip} />
        )}
        {view === 'budget' && !store.activeTrip && (
          <div className="flex items-center justify-center h-64 text-sky-400 text-sm">
            Select a trip to view budget
          </div>
        )}
        {view === 'io' && <ImportExport store={store} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-sky-100 flex z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <MobileTab icon={<Plane size={20} />} label="Trips" active={view === 'trips'} onClick={() => setView('trips')} />
        <MobileTab icon={<CalendarDays size={20} />} label="Detail" active={view === 'detail'} onClick={() => setView('detail')} />
        <MobileTab icon={<DollarSign size={20} />} label="Budget" active={view === 'budget'} onClick={() => setView('budget')} />
        <MobileTab icon={<Printer size={20} />} label="Print" active={false} onClick={() => setView('print')} />
        <MobileTab icon={<FolderDown size={20} />} label="I/O" active={view === 'io'} onClick={() => setView('io')} />
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
        active ? 'text-sky-600 font-semibold' : 'text-gray-400'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function TopNavBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? 'bg-sky-100 text-sky-700'
          : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}
