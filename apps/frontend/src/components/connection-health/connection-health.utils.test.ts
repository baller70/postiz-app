import { describe, expect, it } from 'vitest';
import {
  EXPIRING_SOON_DAYS,
  buildBrandPlatformRows,
  classifyConnectionBrand,
  getBrandStatusTotals,
  getConnectionStatus,
  groupConnectionsByBrand,
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

describe('brand connection classification', () => {
  it.each([
    [{ name: '@bookmarkaihub' }, 'bookmark-ai-hub'],
    [{ display: 'Rise.As.One.AAU' }, 'rise-as-one'],
    [{ name: 'ShotIQ Basketball on YouTube' }, 'shotiq-basketball'],
    [{ name: 'bballfactoryinc' }, 'the-basketball-factory'],
    [{ customer: { name: 'The House of Sports' } }, 'the-house-of-sports'],
    [{ name: 'practicemyshoot' }, 'practice-my-shooting'],
  ])('classifies normalized live account identities', (connection, brand) => {
    expect(classifyConnectionBrand(connection)).toBe(brand);
  });

  it('leaves accounts without a recognizable brand in the All view only', () => {
    expect(classifyConnectionBrand({ name: 'Unrelated Client Account' })).toBe(
      null
    );
  });

  it('groups connections without relying on integration ids', () => {
    const connections = [
      { id: 'dynamic-1', name: 'Bookmark AI Hub', identifier: 'facebook' },
      { id: 'dynamic-2', name: 'bookmarkaihub', identifier: 'threads' },
      { id: 'dynamic-3', name: 'Rise as One AAU', identifier: 'bluesky' },
      { id: 'dynamic-4', name: 'Outside Brand', identifier: 'x' },
    ];

    const groups = groupConnectionsByBrand(connections);

    expect(groups['bookmark-ai-hub'].map(({ id }) => id)).toEqual([
      'dynamic-1',
      'dynamic-2',
    ]);
    expect(groups['rise-as-one'].map(({ id }) => id)).toEqual(['dynamic-3']);
    expect(
      Object.values(groups)
        .flat()
        .some(({ id }) => id === 'dynamic-4')
    ).toBe(false);
  });
});

describe('brand platform matrix', () => {
  const connections = [
    {
      name: 'Bookmark AI Hub',
      identifier: 'facebook',
      status: 'connected' as const,
    },
    {
      name: 'bookmarkaihub',
      identifier: 'linkedin-page',
      status: 'reconnect' as const,
    },
    {
      name: 'BookmarkAIHub',
      identifier: 'mastodon-custom',
      status: 'disabled' as const,
    },
    {
      name: 'Rise as One AAU',
      identifier: 'facebook',
      status: 'connected' as const,
    },
  ];

  it('includes the standard checklist, canonicalizes providers, and appends returned providers', () => {
    const rows = buildBrandPlatformRows(connections, 'bookmark-ai-hub');

    expect(rows.slice(0, 9).map(({ key }) => key)).toEqual([
      'linkedin',
      'instagram',
      'facebook',
      'x',
      'threads',
      'bluesky',
      'gmb',
      'tiktok',
      'youtube',
    ]);
    expect(rows.find(({ key }) => key === 'linkedin')?.status).toBe(
      'reconnect'
    );
    expect(rows.find(({ key }) => key === 'instagram')?.status).toBe('missing');
    expect(rows.at(-1)).toMatchObject({
      key: 'mastodon-custom',
      label: 'Mastodon',
      status: 'disabled',
    });
  });

  it('calculates connected, attention, disabled, and missing platform totals', () => {
    const rows = buildBrandPlatformRows(connections, 'bookmark-ai-hub');

    expect(getBrandStatusTotals(rows)).toEqual({
      connected: 1,
      attention: 1,
      disabled: 1,
      missing: 7,
      present: 3,
    });
  });
});
