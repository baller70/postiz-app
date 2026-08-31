import {
  BRAND_DEFINITIONS,
  BrandClassifiableConnection,
  ConnectionStatusInput,
  classifyConnectionBrand,
  getConnectionStatus,
  groupConnectionsByBrand,
  normalizeConnectionIdentity,
} from '../connection-health/connection-health.utils';

export const ALL_BRANDS = 'all';

export interface AnalyticsIntegrationIdentity
  extends BrandClassifiableConnection,
    ConnectionStatusInput {
  id: string;
  identifier: string;
}

export interface AnalyticsBrandSection<
  TIntegration extends AnalyticsIntegrationIdentity = AnalyticsIntegrationIdentity
> {
  key: string;
  label: string;
  integrations: TIntegration[];
}

const NINETY_DAY_PROVIDERS = new Set([
  'facebook',
  'gmb',
  'linkedin-page',
  'pinterest',
  'x',
  'youtube',
]);

export function buildAnalyticsBrandSections<
  TIntegration extends AnalyticsIntegrationIdentity
>(integrations: TIntegration[]): AnalyticsBrandSection<TIntegration>[] {
  const grouped = groupConnectionsByBrand(integrations);
  const sections: AnalyticsBrandSection<TIntegration>[] =
    BRAND_DEFINITIONS.flatMap((brand) => {
      const brandIntegrations = grouped[brand.key];
      return brandIntegrations.length
        ? [
            {
              key: brand.key,
              label: brand.label,
              integrations: brandIntegrations,
            },
          ]
        : [];
    });
  const fallbackSections = new Map<
    string,
    AnalyticsBrandSection<TIntegration>
  >();
  for (const integration of integrations) {
    if (classifyConnectionBrand(integration)) {
      continue;
    }

    const label =
      integration.customer?.name?.trim() ||
      integration.name?.trim() ||
      integration.display?.trim() ||
      'Unassigned channels';
    const normalizedLabel = normalizeConnectionIdentity(label) || 'unassigned';
    const key = `account-${normalizedLabel}`;
    const section = fallbackSections.get(key) ?? {
      key,
      label: label.replace(/^@/, ''),
      integrations: [],
    };
    section.integrations.push(integration);
    fallbackSections.set(key, section);
  }

  sections.push(
    ...[...fallbackSections.values()].sort((first, second) =>
      first.label.localeCompare(second.label)
    )
  );

  return sections;
}

export function filterAnalyticsBrandSections<
  TIntegration extends AnalyticsIntegrationIdentity
>(sections: AnalyticsBrandSection<TIntegration>[], brandKey: string) {
  return brandKey === ALL_BRANDS
    ? sections
    : sections.filter((section) => section.key === brandKey);
}

export function getAnalyticsDateRanges(
  integrations: AnalyticsIntegrationIdentity[]
) {
  return integrations.length > 0 &&
    integrations.every(({ identifier }) => NINETY_DAY_PROVIDERS.has(identifier))
    ? [7, 30, 90]
    : [7, 30];
}

export function getAnalyticsStatusTotals(
  integrations: AnalyticsIntegrationIdentity[],
  now = Date.now()
) {
  return integrations.reduce(
    (totals, integration) => {
      totals[getConnectionStatus(integration, now)] += 1;
      return totals;
    },
    { connected: 0, reconnect: 0, expiring: 0, disabled: 0 }
  );
}
