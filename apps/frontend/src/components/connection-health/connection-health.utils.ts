export const EXPIRING_SOON_DAYS = 14;

export type ConnectionStatus =
  | 'connected'
  | 'reconnect'
  | 'disabled'
  | 'expiring';

export interface ConnectionStatusInput {
  disabled?: boolean;
  refreshNeeded?: boolean;
  inBetweenSteps?: boolean;
  tokenExpiration?: string | null;
}

export interface BrandClassifiableConnection {
  name?: string | null;
  display?: string | null;
  customer?: {
    name?: string | null;
  } | null;
}

export const BRAND_DEFINITIONS = [
  {
    key: 'bookmark-ai-hub',
    label: 'Bookmark AI Hub',
    aliases: ['Bookmark AI Hub', 'BookmarkAIHub', 'Bookmark AI'],
  },
  {
    key: 'rise-as-one',
    label: 'Rise as One',
    aliases: ['Rise as One AAU', 'Rise as One', 'RiseAsOneAAU', 'RiseAsOne'],
  },
  {
    key: 'shotiq-basketball',
    label: 'ShotIQ Basketball',
    aliases: ['ShotIQ Basketball', 'ShotIQ Bball', 'ShotIQ'],
  },
  {
    key: 'the-basketball-factory',
    label: 'The Basketball Factory',
    aliases: [
      'The Basketball Factory',
      'Basketball Factory NJ',
      'Basketball Factory',
      'BBallFactoryInc',
      'BBallFactory',
    ],
  },
  {
    key: 'the-house-of-sports',
    label: 'The House of Sports',
    aliases: ['The House of Sports', 'House of Sports', 'THOS NJ'],
  },
  {
    key: 'practice-my-shooting',
    label: 'Practice My Shooting',
    aliases: ['Practice My Shooting', 'PracticeMyShooting', 'PracticeMyShoot'],
  },
] as const;

export type BrandKey = (typeof BRAND_DEFINITIONS)[number]['key'];

export function normalizeConnectionIdentity(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function classifyConnectionBrand(
  integration: BrandClassifiableConnection
): BrandKey | null {
  const identities = [
    integration.name,
    integration.display,
    integration.customer?.name,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeConnectionIdentity)
    .filter(Boolean);

  let bestMatch: { key: BrandKey; score: number } | null = null;

  for (const brand of BRAND_DEFINITIONS) {
    for (const alias of brand.aliases) {
      const normalizedAlias = normalizeConnectionIdentity(alias);
      if (
        normalizedAlias &&
        identities.some((identity) => identity.includes(normalizedAlias)) &&
        normalizedAlias.length > (bestMatch?.score ?? 0)
      ) {
        bestMatch = { key: brand.key, score: normalizedAlias.length };
      }
    }
  }

  return bestMatch?.key ?? null;
}

export function groupConnectionsByBrand<
  TConnection extends BrandClassifiableConnection
>(connections: TConnection[]) {
  const groups = Object.fromEntries(
    BRAND_DEFINITIONS.map((brand) => [brand.key, [] as TConnection[]])
  ) as Record<BrandKey, TConnection[]>;

  for (const connection of connections) {
    const brand = classifyConnectionBrand(connection);
    if (brand) {
      groups[brand].push(connection);
    }
  }

  return groups;
}

export function getConnectionStatus(
  integration: ConnectionStatusInput,
  now = Date.now()
): ConnectionStatus {
  if (integration.disabled) {
    return 'disabled';
  }

  if (integration.refreshNeeded || integration.inBetweenSteps) {
    return 'reconnect';
  }

  if (integration.tokenExpiration) {
    const expiration = new Date(integration.tokenExpiration).getTime();
    if (!Number.isNaN(expiration)) {
      if (expiration <= now) {
        return 'reconnect';
      }

      const expiringSoon = now + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
      if (expiration <= expiringSoon) {
        return 'expiring';
      }
    }
  }

  return 'connected';
}

export function isConnectionAttention(status: ConnectionStatus) {
  return status === 'reconnect' || status === 'expiring';
}
