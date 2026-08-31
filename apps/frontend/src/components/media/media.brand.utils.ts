import {
  BRAND_DEFINITIONS,
  classifyConnectionBrand,
  normalizeConnectionIdentity,
} from '../connection-health/connection-health.utils';
import type { BrandClassifiableConnection } from '../connection-health/connection-health.utils';

export const ALL_MEDIA = '__all__';
export const UNFILED_MEDIA = '__unfiled__';

export type MediaBrandSource = BrandClassifiableConnection & {
  identifier?: string | null;
};

export type StoredBrandCount = {
  name: string;
  count: number;
};

export type MediaBrandFolder = {
  id: string;
  name: string;
  count: number;
};

const normalize = (value?: string | null) =>
  normalizeConnectionIdentity(value || '');

const GENERIC_PLATFORM_NAMES = new Set(
  [
    'facebook',
    'facebook page',
    'instagram',
    'threads',
    'linkedin',
    'linkedin page',
    'youtube',
    'tiktok',
    'x',
    'twitter',
    'bluesky',
    'google business',
    'google my business',
  ].map(normalize)
);

export const brandNameFromIntegration = (integration: MediaBrandSource) => {
  const knownBrandKey = classifyConnectionBrand(integration);
  if (knownBrandKey) {
    return BRAND_DEFINITIONS.find((brand) => brand.key === knownBrandKey)
      ?.label;
  }

  const customerName = integration.customer?.name?.trim();
  if (customerName) {
    return customerName;
  }

  const accountName = integration.name?.trim();
  if (
    accountName &&
    normalize(accountName) !== normalize(integration.identifier) &&
    !GENERIC_PLATFORM_NAMES.has(normalize(accountName))
  ) {
    return accountName;
  }

  return undefined;
};

export function deriveMediaBrandFolders(
  integrations: MediaBrandSource[],
  storedBrands: StoredBrandCount[] = []
): MediaBrandFolder[] {
  const storedCounts = new Map(
    storedBrands.map((brand) => [normalize(brand.name), brand.count])
  );
  const folders = new Map<string, MediaBrandFolder>();

  const addBrand = (name?: string) => {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return;
    }

    const knownBrandKey = classifyConnectionBrand({ name: trimmedName });
    const canonicalName =
      BRAND_DEFINITIONS.find((brand) => brand.key === knownBrandKey)?.label ||
      trimmedName;
    const key = normalize(canonicalName);
    if (!key || folders.has(key)) {
      return;
    }

    folders.set(key, {
      id: key,
      name: canonicalName,
      count: storedCounts.get(key) || 0,
    });
  };

  integrations.forEach((integration) =>
    addBrand(brandNameFromIntegration(integration))
  );
  storedBrands.forEach((brand) => addBrand(brand.name));

  const knownOrder = new Map(
    BRAND_DEFINITIONS.map((brand, index) => [normalize(brand.label), index])
  );

  return Array.from(folders.values()).sort((first, second) => {
    const firstOrder = knownOrder.get(normalize(first.name));
    const secondOrder = knownOrder.get(normalize(second.name));
    if (firstOrder !== undefined || secondOrder !== undefined) {
      return (
        (firstOrder ?? Number.MAX_SAFE_INTEGER) -
        (secondOrder ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return first.name.localeCompare(second.name);
  });
}

export const uploadBrandForFolder = (folder: string) =>
  folder === ALL_MEDIA || folder === UNFILED_MEDIA ? '' : folder;
