import { describe, expect, it } from 'vitest';
import {
  ALL_MEDIA,
  UNFILED_MEDIA,
  brandNameFromIntegration,
  deriveMediaBrandFolders,
  uploadBrandForFolder,
} from './media.brand.utils';

describe('media brand folders', () => {
  it('derives canonical folders only from real integration data', () => {
    const folders = deriveMediaBrandFolders([
      { customer: { name: 'BookmarkAIHub' }, name: 'Facebook account' },
      { customer: { name: 'Rise as One AAU' }, name: 'Instagram account' },
      { name: 'shotiqbball', identifier: 'youtube' },
    ]);

    expect(folders.map((folder) => folder.name)).toEqual([
      'Bookmark AI Hub',
      'Rise as One',
      'ShotIQ Basketball',
    ]);
    expect(folders.every((folder) => folder.count === 0)).toBe(true);
  });

  it('does not create empty folders for brands absent from integrations', () => {
    const folders = deriveMediaBrandFolders([
      { customer: { name: 'The Basketball Factory' }, name: 'Facebook' },
    ]);

    expect(folders.map((folder) => folder.name)).toEqual([
      'The Basketball Factory',
    ]);
  });

  it('does not turn a generic social platform label into a brand', () => {
    expect(
      deriveMediaBrandFolders([
        { name: 'Facebook Page', identifier: 'facebook' },
        { name: 'YouTube', identifier: 'youtube' },
      ])
    ).toEqual([]);
  });

  it('keeps genuinely existing dynamic and stored brands with their counts', () => {
    const folders = deriveMediaBrandFolders(
      [{ customer: { name: 'New Training Brand' }, name: 'newtraining' }],
      [
        { name: 'New Training Brand', count: 4 },
        { name: 'Legacy Brand', count: 2 },
      ]
    );

    expect(folders).toEqual([
      { id: 'legacybrand', name: 'Legacy Brand', count: 2 },
      { id: 'newtrainingbrand', name: 'New Training Brand', count: 4 },
    ]);
  });

  it('uses the shared connection-health classifier when identities overlap', () => {
    expect(
      brandNameFromIntegration({
        customer: { name: 'Rise as One' },
        name: 'Bookmark AI Hub archive',
      })
    ).toBe('Bookmark AI Hub');
  });

  it('routes uploads from All and Unfiled to unfiled media', () => {
    expect(uploadBrandForFolder(ALL_MEDIA)).toBe('');
    expect(uploadBrandForFolder(UNFILED_MEDIA)).toBe('');
    expect(uploadBrandForFolder('Bookmark AI Hub')).toBe('Bookmark AI Hub');
  });
});
