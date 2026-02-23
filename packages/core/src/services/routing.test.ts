import { describe, expect, it } from 'vitest';
import { estimateTravelDurationSeconds, haversineDistanceMeters, parseGoogleDurationSeconds } from './routing';

describe('routing helpers', () => {
  it('computes haversine distance for identical points as zero', () => {
    expect(haversineDistanceMeters(0, 0, 0, 0)).toBeCloseTo(0, 6);
  });

  it('computes reasonable haversine distance between SF and LA', () => {
    const distance = haversineDistanceMeters(37.7749, -122.4194, 34.0522, -118.2437);
    expect(distance).toBeGreaterThan(540_000);
    expect(distance).toBeLessThan(580_000);
  });

  it('estimates different fallback durations per mode', () => {
    const distance = 10_000;
    expect(estimateTravelDurationSeconds(distance, 'WALK')).toBeGreaterThan(estimateTravelDurationSeconds(distance, 'TRANSIT'));
    expect(estimateTravelDurationSeconds(distance, 'TRANSIT')).toBeGreaterThan(estimateTravelDurationSeconds(distance, 'DRIVE'));
  });

  it('parses google duration strings in seconds', () => {
    expect(parseGoogleDurationSeconds('3759s')).toBe(3759);
    expect(parseGoogleDurationSeconds('12.4s')).toBe(12);
  });
});
