import { describe, expect, it } from 'vitest';
import {
  EXPIRING_SOON_DAYS,
  getConnectionStatus,
  isConnectionAttention,
} from './connection-health.utils';

const now = new Date('2026-08-31T12:00:00.000Z').getTime();

describe('getConnectionStatus', () => {
  it('prioritizes disabled over other states', () => {
    expect(
      getConnectionStatus(
        { disabled: true, refreshNeeded: true, tokenExpiration: null },
        now
      )
    ).toBe('disabled');
  });

  it('requires reconnect for flagged, incomplete, or expired channels', () => {
    expect(getConnectionStatus({ refreshNeeded: true }, now)).toBe('reconnect');
    expect(getConnectionStatus({ inBetweenSteps: true }, now)).toBe(
      'reconnect'
    );
    expect(
      getConnectionStatus({ tokenExpiration: '2026-08-30T12:00:00.000Z' }, now)
    ).toBe('reconnect');
  });

  it('marks tokens inside the warning window as expiring soon', () => {
    const expiration = new Date(
      now + (EXPIRING_SOON_DAYS - 1) * 24 * 60 * 60 * 1000
    ).toISOString();

    expect(getConnectionStatus({ tokenExpiration: expiration }, now)).toBe(
      'expiring'
    );
    expect(isConnectionAttention('expiring')).toBe(true);
  });

  it('leaves healthy channels connected', () => {
    expect(getConnectionStatus({}, now)).toBe('connected');
    expect(
      getConnectionStatus({ tokenExpiration: '2026-10-17T12:00:00.000Z' }, now)
    ).toBe('connected');
    expect(isConnectionAttention('connected')).toBe(false);
  });
});
