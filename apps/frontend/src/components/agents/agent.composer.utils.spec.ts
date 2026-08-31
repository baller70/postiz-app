import { describe, expect, it } from 'vitest';
import {
  AgentIntegration,
  getBrandSelectionState,
  groupIntegrationsByBrand,
  toggleBrandSelection,
  toggleIntegrationSelection,
} from './agent.composer.utils';

const integration = (
  overrides: Partial<AgentIntegration> & Pick<AgentIntegration, 'id'>
): AgentIntegration => ({
  id: overrides.id,
  internalId: `internal-${overrides.id}`,
  name: 'Channel account',
  identifier: 'facebook',
  display: 'Channel account',
  type: 'social',
  picture: '/no-picture.jpg',
  inBetweenSteps: false,
  editor: 'normal',
  additionalSettings: '[]',
  changeProfilePicture: false,
  changeNickName: false,
  time: [],
  ...overrides,
});

describe('agent composer brand grouping', () => {
  it('groups live integrations by known customer and account brand names', () => {
    const groups = groupIntegrationsByBrand([
      integration({
        id: 'facebook-bookmark',
        customer: { name: 'Bookmark AI Hub' },
      }),
      integration({
        id: 'threads-rise',
        name: 'rise.as.one.aau',
        identifier: 'threads',
      }),
      integration({
        id: 'youtube-shotiq',
        name: 'ShotIQ Basketball',
        identifier: 'youtube',
      }),
      integration({
        id: 'facebook-factory',
        display: 'The Basketball Factory',
      }),
      integration({
        id: 'linkedin-house',
        customer: { name: 'The House of Sports' },
        identifier: 'linkedin-page',
      }),
      integration({
        id: 'x-practice',
        name: 'practicemyshoot',
        identifier: 'x',
      }),
    ]);

    expect(groups.map((group) => group.name)).toEqual([
      'Bookmark AI Hub',
      'Rise as One',
      'ShotIQ Basketball',
      'The Basketball Factory',
      'The House of Sports',
      'Practice My Shooting',
    ]);
    expect(groups.every((group) => group.integrations.length === 1)).toBe(true);
  });

  it('keeps unmatched customer groups available without inventing channel ids', () => {
    const groups = groupIntegrationsByBrand([
      integration({
        id: 'custom-channel-id',
        customer: { name: 'A New Brand' },
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('A New Brand');
    expect(groups[0].integrations[0].id).toBe('custom-channel-id');
  });

  it('omits brands and platforms that are not present in the integration data', () => {
    const groups = groupIntegrationsByBrand([
      integration({
        id: 'bookmark-facebook-only',
        customer: { name: 'Bookmark AI Hub' },
        identifier: 'facebook',
      }),
    ]);

    expect(groups.map((group) => group.name)).toEqual(['Bookmark AI Hub']);
    expect(groups[0].integrations.map((item) => item.identifier)).toEqual([
      'facebook',
    ]);
  });

  it('uses the real customer brand before a conflicting account label', () => {
    const groups = groupIntegrationsByBrand([
      integration({
        id: 'customer-owned-channel',
        customer: { name: 'Rise as One AAU' },
        name: 'Bookmark AI Hub archive',
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Rise as One');
    expect(groups[0].integrations[0].id).toBe('customer-owned-channel');
  });
});

describe('agent composer selection', () => {
  const facebook = integration({ id: 'facebook', identifier: 'facebook' });
  const threads = integration({ id: 'threads', identifier: 'threads' });
  const reconnecting = integration({
    id: 'linkedin',
    identifier: 'linkedin-page',
    refreshNeeded: true,
  });
  const outsideBrand = integration({ id: 'youtube', identifier: 'youtube' });

  it('attaches and detaches an individual selectable integration', () => {
    expect(toggleIntegrationSelection([], facebook)).toEqual([facebook]);
    expect(toggleIntegrationSelection([facebook], facebook)).toEqual([]);
    expect(toggleIntegrationSelection([], reconnecting)).toEqual([]);
  });

  it('toggles every healthy channel in a brand while preserving other brands', () => {
    const attached = toggleBrandSelection(
      [outsideBrand],
      [facebook, threads, reconnecting]
    );

    expect(attached.map((item) => item.id)).toEqual([
      'youtube',
      'facebook',
      'threads',
    ]);
    expect(
      toggleBrandSelection(attached, [facebook, threads, reconnecting])
    ).toEqual([outsideBrand]);
  });

  it('reports whole-brand and partial selection states from healthy channels', () => {
    expect(
      getBrandSelectionState([facebook], [facebook, threads, reconnecting])
    ).toEqual({
      selectedCount: 1,
      availableCount: 2,
      allSelected: false,
      partiallySelected: true,
    });
    expect(
      getBrandSelectionState(
        [facebook, threads],
        [facebook, threads, reconnecting]
      )
    ).toEqual({
      selectedCount: 2,
      availableCount: 2,
      allSelected: true,
      partiallySelected: false,
    });
  });
});
