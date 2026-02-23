import type { Template } from './types';

/** Returns fresh copies of built-in templates (always have builtIn: true). */
export function builtInTemplates(): Template[] {
  return [
    {
      id: '_tpl_city_weekend',
      name: 'City Weekend',
      description: 'A quick 2-day city break with sightseeing, food & nightlife',
      builtIn: true,
      currency: 'SGD',
      days: [
        {
          label: 'Day 1 — Arrival & Explore',
          items: [
            { title: 'Check in to hotel', time: '14:00', tags: ['accommodation'] },
            { title: 'Walk around the neighbourhood', time: '15:30', tags: ['explore'] },
            { title: 'Dinner at a local restaurant', time: '19:00', tags: ['food'] },
          ],
        },
        {
          label: 'Day 2 — Sightseeing & Departure',
          items: [
            { title: 'Breakfast at café', time: '09:00', tags: ['food'] },
            { title: 'Visit main attraction', time: '10:30', tags: ['sightseeing'] },
            { title: 'Souvenir shopping', time: '14:00', tags: ['shopping'] },
            { title: 'Head to airport', time: '17:00', tags: ['transport'] },
          ],
        },
      ],
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '_tpl_road_trip',
      name: 'Road Trip',
      description: '3-day road trip with driving legs, stops & camping',
      builtIn: true,
      currency: 'SGD',
      days: [
        {
          label: 'Day 1 — Hit the Road',
          items: [
            { title: 'Pack the car & depart', time: '08:00', tags: ['transport'] },
            { title: 'Scenic stop / photo op', time: '11:00', tags: ['explore'] },
            { title: 'Lunch at roadside diner', time: '12:30', tags: ['food'] },
            { title: 'Arrive at campsite / hotel', time: '17:00', tags: ['accommodation'] },
          ],
        },
        {
          label: 'Day 2 — Explore the Area',
          items: [
            { title: 'Morning hike / nature walk', time: '08:00', tags: ['outdoors'] },
            { title: 'Local lunch', time: '12:00', tags: ['food'] },
            { title: 'Afternoon activity', time: '14:00', tags: ['activity'] },
            { title: 'Campfire / evening chill', time: '19:00', tags: ['leisure'] },
          ],
        },
        {
          label: 'Day 3 — Return Journey',
          items: [
            { title: 'Breakfast & pack up', time: '08:00', tags: ['food'] },
            { title: 'Drive home with stops', time: '10:00', tags: ['transport'] },
          ],
        },
      ],
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '_tpl_business_trip',
      name: 'Business Trip',
      description: 'Structured 2-day trip with meetings, meals & downtime',
      builtIn: true,
      currency: 'USD',
      days: [
        {
          label: 'Day 1 — Meetings',
          items: [
            { title: 'Flight / arrive at hotel', time: '09:00', tags: ['transport'] },
            { title: 'Team lunch', time: '12:00', tags: ['food', 'work'] },
            { title: 'Afternoon meetings', time: '14:00', tags: ['work'] },
            { title: 'Client dinner', time: '19:00', tags: ['food', 'work'] },
          ],
        },
        {
          label: 'Day 2 — Wrap Up',
          items: [
            { title: 'Morning workshop', time: '09:00', tags: ['work'] },
            { title: 'Working lunch', time: '12:00', tags: ['food', 'work'] },
            { title: 'Debrief & depart', time: '15:00', tags: ['transport'] },
          ],
        },
      ],
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: '_tpl_theme_park',
      name: 'Theme Park Day',
      description: 'Full-day theme park itinerary with rides, shows & meals',
      builtIn: true,
      currency: 'SGD',
      days: [
        {
          label: 'Theme Park Day',
          items: [
            { title: 'Arrive at park opening', time: '09:00', tags: ['activity'] },
            { title: 'Hit popular rides first', time: '09:30', tags: ['activity'] },
            { title: 'Mid-morning snack', time: '11:00', tags: ['food'] },
            { title: 'Watch show / parade', time: '12:00', tags: ['entertainment'] },
            { title: 'Lunch', time: '13:00', tags: ['food'] },
            { title: 'Afternoon rides & attractions', time: '14:30', tags: ['activity'] },
            { title: 'Dinner in the park', time: '18:00', tags: ['food'] },
            { title: 'Evening fireworks / closing show', time: '20:00', tags: ['entertainment'] },
          ],
        },
      ],
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  ];
}
