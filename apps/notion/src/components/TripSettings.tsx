import React, { useEffect, useState } from 'react';
import type { AppSettings, Trip, ThemePreference, TravelMode } from '@trip-planner/core';
import {
  CURRENCIES,
  DEFAULT_NOMINATIM_ENDPOINT,
  clearRoutingCache,
  fetchExchangeRates,
} from '@trip-planner/core';
import { Button, Input, Select, Modal, TextArea, toast } from '@trip-planner/ui';
import { Sun, Moon, Monitor, Info, Route, Coins } from 'lucide-react';

interface TripSettingsProps {
  open: boolean;
  trip: Trip;
  settings: AppSettings;
  onClose: () => void;
  onUpdate: (updates: Partial<Pick<Trip, 'name' | 'startDate' | 'endDate' | 'baseCurrency' | 'travelDefaults'>>) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
}

const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
];

const travelModeOptions: { value: TravelMode; label: string }[] = [
  { value: 'WALK', label: 'Walk' },
  { value: 'DRIVE', label: 'Drive' },
  { value: 'TRANSIT', label: 'Transit' },
];

export function TripSettings({
  open,
  trip,
  settings,
  onClose,
  onUpdate,
  theme,
  onThemeChange,
  onUpdateSettings,
}: TripSettingsProps) {
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate ?? '');
  const [endDate, setEndDate] = useState(trip.endDate ?? '');
  const [baseCurrency, setBaseCurrency] = useState(trip.baseCurrency);
  const [defaultTravelMode, setDefaultTravelMode] = useState<TravelMode>(trip.travelDefaults?.mode ?? 'WALK');
  const [tripTrafficAwareDrive, setTripTrafficAwareDrive] = useState(!!trip.travelDefaults?.trafficAware);

  const [endpoint, setEndpoint] = useState(settings.geocodingProviderEndpoint);
  const [googleApiKey, setGoogleApiKey] = useState(settings.routing.googleApiKey ?? '');
  const [computeTravelLazily, setComputeTravelLazily] = useState(settings.routing.computeTravelLazily);
  const [showRoutesOnMapByDefault, setShowRoutesOnMapByDefault] = useState(settings.routing.showRoutesOnMapByDefault);
  const [routeCacheTtlHours, setRouteCacheTtlHours] = useState(String(Math.round(settings.routing.routeCacheTtlMs / (60 * 60 * 1000))));

  const [manualOverridesText, setManualOverridesText] = useState('{}');
  const [useManualRatesOnly, setUseManualRatesOnly] = useState(!!settings.exchangeRates.useManualRatesOnly);
  const [ratesLoading, setRatesLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(trip.name);
    setStartDate(trip.startDate ?? '');
    setEndDate(trip.endDate ?? '');
    setBaseCurrency(trip.baseCurrency);
    setDefaultTravelMode(trip.travelDefaults?.mode ?? 'WALK');
    setTripTrafficAwareDrive(!!trip.travelDefaults?.trafficAware);

    setEndpoint(settings.geocodingProviderEndpoint);
    setGoogleApiKey(settings.routing.googleApiKey ?? '');
    setComputeTravelLazily(settings.routing.computeTravelLazily);
    setShowRoutesOnMapByDefault(settings.routing.showRoutesOnMapByDefault);
    setRouteCacheTtlHours(String(Math.max(1, Math.round(settings.routing.routeCacheTtlMs / (60 * 60 * 1000)))));
    setUseManualRatesOnly(!!settings.exchangeRates.useManualRatesOnly);
    setManualOverridesText(JSON.stringify(settings.exchangeRates.manualOverrides ?? {}, null, 2));
  }, [open, trip, settings]);

  const parsedManualOverrides = (() => {
    try {
      const parsed = JSON.parse(manualOverridesText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { value: null as Record<string, number> | null, error: 'Manual overrides must be a JSON object' };
      }
      const normalized: Record<string, number> = {};
      for (const [currency, rate] of Object.entries(parsed)) {
        if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
          return { value: null, error: `Invalid rate for ${currency}` };
        }
        normalized[currency.toUpperCase()] = rate;
      }
      return { value: normalized, error: null };
    } catch {
      return { value: null as Record<string, number> | null, error: 'Invalid JSON' };
    }
  })();

  const handleRefreshRates = async () => {
    setRatesLoading(true);
    try {
      const fetched = await fetchExchangeRates(baseCurrency || trip.baseCurrency);
      onUpdateSettings({
        exchangeRates: {
          ...fetched,
          manualOverrides: settings.exchangeRates.manualOverrides ?? {},
          useManualRatesOnly,
        },
      });
      toast('Exchange rates updated');
    } catch (error) {
      console.error(error);
      toast('Failed to update rates', 'error');
    } finally {
      setRatesLoading(false);
    }
  };

  const handleClearRouteCache = async () => {
    try {
      await clearRoutingCache();
      toast('Routing cache cleared');
    } catch (error) {
      console.error(error);
      toast('Failed to clear routing cache', 'error');
    }
  };

  const handleSave = () => {
    if (parsedManualOverrides.error) {
      toast(parsedManualOverrides.error, 'error');
      return;
    }

    onUpdate({
      name: name.trim() || trip.name,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      baseCurrency: (baseCurrency || trip.baseCurrency).toUpperCase(),
      travelDefaults: {
        mode: defaultTravelMode,
        trafficAware: defaultTravelMode === 'DRIVE' ? tripTrafficAwareDrive : false,
      },
    });

    const ttlHours = Math.max(1, Number.parseFloat(routeCacheTtlHours) || 168);

    onUpdateSettings({
      geocodingProviderEndpoint: endpoint.trim() || DEFAULT_NOMINATIM_ENDPOINT,
      routing: {
        providerId: 'google_routes',
        googleApiKey,
        computeTravelLazily,
        showRoutesOnMapByDefault,
        routeCacheTtlMs: Math.round(ttlHours * 60 * 60 * 1000),
      },
      exchangeRates: {
        ...settings.exchangeRates,
        base: (settings.exchangeRates.base || baseCurrency || trip.baseCurrency).toUpperCase(),
        manualOverrides: parsedManualOverrides.value ?? {},
        useManualRatesOnly,
      },
    });

    toast('Settings saved');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Trip Settings">
      <div className="flex flex-col gap-4">
        <Input label="Trip Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <Select
          label="Base Currency"
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
        />

        <Select
          label="Default Travel Mode"
          value={defaultTravelMode}
          onChange={(e) => setDefaultTravelMode(e.target.value as TravelMode)}
          options={travelModeOptions}
        />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</span>
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onThemeChange(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  theme === opt.value
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Route size={14} className="text-gray-500 dark:text-gray-400" />
            Routing
          </div>
          <Input
            label="Google Maps API key (Routes API)"
            value={googleApiKey}
            onChange={(e) => setGoogleApiKey(e.target.value)}
            placeholder="Stored locally only"
            type="password"
          />
          <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-400">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={tripTrafficAwareDrive}
                onChange={(e) => setTripTrafficAwareDrive(e.target.checked)}
              />
              Use traffic-aware routes (DRIVE only)
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={computeTravelLazily} onChange={(e) => setComputeTravelLazily(e.target.checked)} />
              Compute travel lazily (recommended)
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={showRoutesOnMapByDefault} onChange={(e) => setShowRoutesOnMapByDefault(e.target.checked)} />
              Show routes on map by default
            </label>
          </div>
          <Input
            label="Route cache TTL (hours)"
            type="number"
            min="1"
            step="1"
            value={routeCacheTtlHours}
            onChange={(e) => setRouteCacheTtlHours(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => { void handleClearRouteCache(); }}>
              Clear routing cache
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Routing is computed only when you tap compute actions to avoid quota/cost spikes. The API key is stored locally in this browser.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Because this app runs on GitHub Pages, protect the key with HTTP referrer restrictions:
            {' '}
            <code>https://seaboiii.github.io/trip_planner/*</code>
            {' '}
            and restrict allowed APIs to <strong>Routes API</strong>.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Coins size={14} className="text-gray-500 dark:text-gray-400" />
            Exchange Rates
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Provider: Frankfurter (latest rates, no API key). Rates are stored locally and used for budget + split calculations.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Button type="button" size="sm" variant="secondary" onClick={() => { void handleRefreshRates(); }} disabled={ratesLoading}>
              {ratesLoading ? 'Updating...' : 'Update rates'}
            </Button>
            {settings.exchangeRates.fetchedAt && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Last updated: {new Date(settings.exchangeRates.fetchedAt).toLocaleString()}
              </span>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={useManualRatesOnly} onChange={(e) => setUseManualRatesOnly(e.target.checked)} />
            Use manual rates only
          </label>
          <TextArea
            label="Manual rate overrides (JSON: 1 {base} -> X currency)"
            value={manualOverridesText}
            onChange={(e) => setManualOverridesText(e.target.value)}
            placeholder='{"JPY": 150.5, "EUR": 0.92}'
            rows={5}
          />
          {parsedManualOverrides.error && (
            <p className="text-xs text-red-600 dark:text-red-400">{parsedManualOverrides.error}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Info size={14} className="text-gray-500 dark:text-gray-400" />
            Location Search (Advanced)
          </div>
          <Input
            label="Geocoding provider endpoint"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder={DEFAULT_NOMINATIM_ENDPOINT}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Default is OpenStreetMap Nominatim. Keep requests at or under 1 request/sec and cache results.
          </p>
          <button
            type="button"
            onClick={() => setEndpoint(DEFAULT_NOMINATIM_ENDPOINT)}
            className="self-start text-xs text-blue-600 hover:text-blue-700"
          >
            Reset to default
          </button>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">About data</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Map/place data use OpenStreetMap. Search uses Nominatim, opening hours use Overpass, and travel routing uses Google Maps Platform Routes API (with your own restricted browser key).
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            OpenStreetMap data and Google route availability can vary by region and may be incomplete for some transit routes.
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700"
            >
              OpenStreetMap attribution
            </a>
            <a
              href="https://operations.osmfoundation.org/policies/nominatim/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700"
            >
              Nominatim usage policy
            </a>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
