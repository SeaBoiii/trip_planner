import { describe, expect, it } from 'vitest';
import { importTrips } from './storage';

describe('storage migration', () => {
  it('migrates legacy trip currency, numeric item cost, and string location', () => {
    const legacyPayload = {
      version: 3,
      data: {
        trips: [
          {
            id: 'trip1',
            name: 'Legacy Trip',
            currency: 'EUR',
            days: [
              {
                id: 'day1',
                label: 'Day 1',
                items: [
                  {
                    id: 'item1',
                    title: 'Lunch',
                    location: 'Paris',
                    cost: 12.5,
                    tags: [],
                  },
                ],
              },
            ],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        activeTripId: 'trip1',
        templates: [],
        settings: {
          theme: 'system',
          geocodingProviderEndpoint: 'https://nominatim.openstreetmap.org',
        },
      },
    };

    const migrated = importTrips(JSON.stringify(legacyPayload));
    const trip = migrated.trips[0];
    const item = trip.days[0].items[0];

    expect(trip.baseCurrency).toBe('EUR');
    expect('currency' in trip).toBe(false);
    expect(trip.participants).toEqual([]);
    expect(trip.defaultTravelMode).toBe('WALK');

    expect(item.locationText).toBe('Paris');
    expect(item.location).toBeUndefined();
    expect(item.cost).toEqual({ amount: 12.5, currency: 'EUR' });

    expect(migrated.settings.routing.providerId).toBe('google_routes');
    expect(migrated.settings.routing.googleApiKey).toBeDefined();
    expect(migrated.settings.exchangeRates.provider).toBe('frankfurter');
  });
});
