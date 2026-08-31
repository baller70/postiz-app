import { describe, expect, it } from 'vitest';
import {
  ALL_BRANDS,
  buildAnalyticsBrandSections,
  filterAnalyticsBrandSections,
  getAnalyticsDateRanges,
  getAnalyticsStatusTotals,
} from './brand.analytics.utils';

const integrations = [
  {
    id: 'bookmark-facebook',
    name: 'Bookmark AI Hub',
    identifier: 'facebook',
  },
  {
    id: 'bookmark-youtube',
    name: '@bookmarkaihub',
    identifier: 'youtube',
  },
  {
    id: 'house-facebook',
    name: 'The House of Sports',
    identifier: 'facebook',
  },
  {
    id: 'house-instagram',
    customer: { name: 'The House of Sports' },
    identifier: 'instagram-standalone',
  },
  {
    id: 'other-x',
    name: 'Actual Client Account',
    identifier: 'x',
  },
];

describe('Analytics brand sections', () => {
  it('uses the shared brand classification and only returns brands with records', () => {
    const sections = buildAnalyticsBrandSections(integrations);

    expect(sections.map(({ label }) => label)).toEqual([
      'Bookmark AI Hub',
      'The House of Sports',
      'Actual Client Account',
    ]);
    expect(sections.some(({ label }) => label === 'Rise as One')).toBe(false);
  });

  it('shows only the actual individual channels associated with a brand', () => {
    const house = buildAnalyticsBrandSections(integrations).find(
      ({ key }) => key === 'the-house-of-sports'
    );

    expect(house?.integrations.map(({ identifier }) => identifier)).toEqual([
      'facebook',
      'instagram-standalone',
    ]);
    expect(
      house?.integrations.some(
        ({ identifier }) => identifier === 'linkedin-page'
      )
    ).toBe(false);
  });

  it('uses actual account names as the fallback for other users', () => {
    const sections = buildAnalyticsBrandSections(integrations);
    const visible = filterAnalyticsBrandSections(sections, ALL_BRANDS);

    expect(
      visible.flatMap(({ integrations: records }) => records)
    ).toHaveLength(integrations.length);
    expect(visible.at(-1)?.integrations[0].id).toBe('other-x');
    expect(visible.at(-1)?.label).toBe('Actual Client Account');
  });
});

describe('Analytics range and connection status', () => {
  it('keeps the existing 90-day provider restrictions', () => {
    expect(
      getAnalyticsDateRanges([
        { id: 'facebook', identifier: 'facebook' },
        { id: 'youtube', identifier: 'youtube' },
      ])
    ).toEqual([7, 30, 90]);
    expect(
      getAnalyticsDateRanges([
        { id: 'facebook', identifier: 'facebook' },
        { id: 'instagram', identifier: 'instagram' },
      ])
    ).toEqual([7, 30]);
  });

  it('summarizes the real integration connection states', () => {
    const now = new Date('2026-08-31T12:00:00.000Z').getTime();
    expect(
      getAnalyticsStatusTotals(
        [
          { id: '1', identifier: 'facebook' },
          { id: '2', identifier: 'x', refreshNeeded: true },
          { id: '3', identifier: 'youtube', disabled: true },
          {
            id: '4',
            identifier: 'gmb',
            tokenExpiration: '2026-09-05T12:00:00.000Z',
          },
        ],
        now
      )
    ).toEqual({ connected: 1, reconnect: 1, expiring: 1, disabled: 1 });
  });
});
