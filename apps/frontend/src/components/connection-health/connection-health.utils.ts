export const EXPIRING_SOON_DAYS = 14;

export type ConnectionStatus =
  | 'connected'
  | 'reconnect'
  | 'disabled'
  | 'expiring';

export type BrandPlatformStatus = ConnectionStatus | 'missing';

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

export interface BrandMatrixConnection extends BrandClassifiableConnection {
  identifier: string;
  status: ConnectionStatus;
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

export const CORE_PLATFORM_DEFINITIONS = [
  {
    key: 'linkedin',
    label: 'LinkedIn',
    iconIdentifier: 'linkedin',
    identifiers: ['linkedin', 'linkedin-page'],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    iconIdentifier: 'instagram',
    identifiers: ['instagram', 'instagram-standalone'],
  },
  {
    key: 'facebook',
    label: 'Facebook',
    iconIdentifier: 'facebook',
    identifiers: ['facebook'],
  },
  {
    key: 'x',
    label: 'X',
    iconIdentifier: 'x',
    identifiers: ['x'],
  },
  {
    key: 'threads',
    label: 'Threads',
    iconIdentifier: 'threads',
    identifiers: ['threads'],
  },
  {
    key: 'bluesky',
    label: 'Bluesky',
    iconIdentifier: 'bluesky',
    identifiers: ['bluesky'],
  },
  {
    key: 'gmb',
    label: 'Google Business Profile',
    iconIdentifier: 'gmb',
    identifiers: ['gmb'],
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    iconIdentifier: 'tiktok',
    identifiers: ['tiktok'],
  },
  {
    key: 'youtube',
    label: 'YouTube',
    iconIdentifier: 'youtube',
    identifiers: ['youtube'],
  },
] as const;

interface BrandPlatformRowBase {
  key: string;
  label: string;
  iconIdentifier: string;
  status: BrandPlatformStatus;
}

export interface BrandPlatformRow<
  TConnection extends BrandMatrixConnection = BrandMatrixConnection
> extends BrandPlatformRowBase {
  connections: TConnection[];
}

export interface BrandStatusTotals {
  connected: number;
  attention: number;
  disabled: number;
  missing: number;
  present: number;
}

const PROVIDER_NAMES: Record<string, string> = {
  gmb: 'Google Business Profile',
  x: 'X',
  'linkedin-page': 'LinkedIn Page',
  linkedin: 'LinkedIn Profile',
  'instagram-standalone': 'Instagram',
  'mastodon-custom': 'Mastodon',
};

const STATUS_PRIORITY: Record<ConnectionStatus, number> = {
  reconnect: 0,
  expiring: 1,
  disabled: 2,
  connected: 3,
};

export function formatProvider(identifier: string) {
  if (PROVIDER_NAMES[identifier]) {
    return PROVIDER_NAMES[identifier];
  }

  return identifier
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

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

function getPlatformDefinition(identifier: string) {
  return CORE_PLATFORM_DEFINITIONS.find((platform) =>
    (platform.identifiers as readonly string[]).includes(identifier)
  );
}

function getAggregateStatus(
  connections: BrandMatrixConnection[]
): ConnectionStatus {
  return (
    [...connections].sort(
      (first, second) =>
        STATUS_PRIORITY[first.status] - STATUS_PRIORITY[second.status]
    )[0]?.status ?? 'connected'
  );
}

export function buildBrandPlatformRows<
  TConnection extends BrandMatrixConnection
>(
  connections: TConnection[],
  brandKey: BrandKey
): BrandPlatformRow<TConnection>[] {
  const brandConnections = connections.filter(
    (connection) => classifyConnectionBrand(connection) === brandKey
  );
  const grouped = new Map<string, TConnection[]>();

  for (const connection of brandConnections) {
    const platform = getPlatformDefinition(connection.identifier);
    const key = platform?.key ?? connection.identifier;
    grouped.set(key, [...(grouped.get(key) ?? []), connection]);
  }

  const coreRows = CORE_PLATFORM_DEFINITIONS.map((platform) => {
    const platformConnections = grouped.get(platform.key) ?? [];
    grouped.delete(platform.key);
    return {
      key: platform.key,
      label: platform.label,
      iconIdentifier: platform.iconIdentifier,
      connections: platformConnections,
      status: platformConnections.length
        ? getAggregateStatus(platformConnections)
        : 'missing',
    } satisfies BrandPlatformRow<TConnection>;
  });

  const additionalRows = [...grouped.entries()]
    .map(([key, platformConnections]) => ({
      key,
      label: formatProvider(key),
      iconIdentifier: platformConnections[0]?.identifier ?? key,
      connections: platformConnections,
      status: getAggregateStatus(platformConnections),
    }))
    .sort((first, second) => first.label.localeCompare(second.label));

  return [...coreRows, ...additionalRows];
}

export function getBrandStatusTotals(
  rows: BrandPlatformRow[]
): BrandStatusTotals {
  return rows.reduce<BrandStatusTotals>(
    (totals, row) => {
      if (row.status !== 'missing') {
        totals.present += 1;
      }

      if (row.status === 'connected') {
        totals.connected += 1;
      } else if (row.status === 'reconnect' || row.status === 'expiring') {
        totals.attention += 1;
      } else if (row.status === 'disabled') {
        totals.disabled += 1;
      } else {
        totals.missing += 1;
      }

      return totals;
    },
    { connected: 0, attention: 0, disabled: 0, missing: 0, present: 0 }
  );
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
