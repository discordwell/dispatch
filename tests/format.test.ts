import { describe, it, expect } from 'vitest';
import { formatClock, formatCountdown, formatMoney } from '../src/ui/format';

describe('formatMoney', () => {
  it('rounds and groups thousands behind the currency mark', () => {
    expect(formatMoney(0)).toBe('§0');
    expect(formatMoney(1234)).toBe('§1,234');
    expect(formatMoney(99.6)).toBe('§100');
  });

  it('puts the sign before the currency mark for negative earnings', () => {
    expect(formatMoney(-350)).toBe('−§350');
    expect(formatMoney(-1234.4)).toBe('−§1,234');
    expect(formatMoney(-0.4)).toBe('§0'); // rounds to zero — no stray sign
  });
});

describe('formatClock', () => {
  it('renders M:SS, rounding part-seconds up', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(500)).toBe('0:01');
    expect(formatClock(61_000)).toBe('1:01');
    expect(formatClock(120_000)).toBe('2:00');
  });

  it('clamps negatives to 0:00', () => {
    expect(formatClock(-5000)).toBe('0:00');
  });
});

describe('formatCountdown', () => {
  it('uses compact seconds under a minute, M:SS from one minute up', () => {
    expect(formatCountdown(0)).toBe('0s');
    expect(formatCountdown(59_000)).toBe('59s');
    expect(formatCountdown(59_001)).toBe('1:00'); // ceil crosses the minute
    expect(formatCountdown(90_000)).toBe('1:30');
  });
});
