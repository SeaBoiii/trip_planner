import { describe, expect, it } from 'vitest';
import { estimateTravelDurationSeconds, haversineDistanceMeters } from './routing';

describe('routing helpers', () => {
  it('computes haversine distance for identical points as zero', () => {
    expect(haversineDistanceMeters([0, 0], [0, 0])).toBeCloseTo(0, 6);
  });

  it('computes reasonable haversine distance between SF and LA', () => {
    const sf: [number, number] = [-122.4194, 37.7749];
    const la: [number, number] = [-118.2437, 34.0522];
    const distance = haversineDistanceMeters(sf, la);
    expect(distance).toBeGreaterThan(540_000);
    expect(distance).toBeLessThan(580_000);
  });

  it('estimates different fallback durations per mode', () => {
    const distance = 10_000;
    expect(estimateTravelDurationSeconds(distance, 'walk')).toBeGreaterThan(estimateTravelDurationSeconds(distance, 'transit'));
    expect(estimateTravelDurationSeconds(distance, 'transit')).toBeGreaterThan(estimateTravelDurationSeconds(distance, 'drive'));
  });
});
