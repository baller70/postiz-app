import type { Integrations } from '@gitroom/frontend/components/launches/calendar.context';

export type AgentIntegration = Integrations & {
  internalId?: string;
  refreshNeeded?: boolean;
};

export type BrandGroup = {
  id: string;
  name: string;
  integrations: AgentIntegration[];
};

type BrandDefinition = {
  id: string;
  name: string;
  aliases: string[];
};

export const BRAND_DEFINITIONS: BrandDefinition[] = [
  {
    id: 'bookmark-ai-hub',
    name: 'Bookmark AI Hub',
    aliases: ['bookmark ai hub', 'bookmarkaihub'],
  },
  {
    id: 'rise-as-one',
    name: 'Rise as One',
    aliases: ['rise as one', 'riseasone', 'rise as one aau', 'riseasoneaau'],
  },
  {
    id: 'shotiq-basketball',
    name: 'ShotIQ Basketball',
    aliases: ['shotiq basketball', 'shotiqbasketball', 'shotiqbball'],
  },
  {
    id: 'the-basketball-factory',
    name: 'The Basketball Factory',
    aliases: ['the basketball factory', 'thebasketballfactory'],
  },
  {
    id: 'the-house-of-sports',
    name: 'The House of Sports',
    aliases: ['the house of sports', 'thehouseofsports', 'house of sports'],
  },
  {
    id: 'practice-my-shooting',
    name: 'Practice My Shooting',
    aliases: ['practice my shooting', 'practicemyshooting', 'practicemyshoot'],
  },
];

const normalize = (value?: string | null) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const valueMatchesBrand = (value: string, definition: BrandDefinition) => {
  const aliases = definition.aliases.map(normalize);
  const normalizedValue = normalize(value);
  return aliases.some(
    (alias) =>
      normalizedValue === alias ||
      normalizedValue.startsWith(alias) ||
      normalizedValue.endsWith(alias)
  );
};

const knownBrandForIntegration = (integration: AgentIntegration) => {
  const customerName = integration.customer?.name?.trim();
  const customerMatch = customerName
    ? BRAND_DEFINITIONS.find((definition) =>
        valueMatchesBrand(customerName, definition)
      )
    : undefined;

  if (customerMatch) {
    return customerMatch;
  }

  return BRAND_DEFINITIONS.find((definition) =>
    [integration.name, integration.display].some((value) =>
      valueMatchesBrand(value, definition)
    )
  );
};

const dynamicBrandName = (integration: AgentIntegration) =>
  integration.customer?.name?.trim() || integration.name.trim() || 'Other';

export function groupIntegrationsByBrand(
  integrations: AgentIntegration[]
): BrandGroup[] {
  const knownGroups = new Map<string, BrandGroup>(
    BRAND_DEFINITIONS.map((definition) => [
      definition.id,
      {
        id: definition.id,
        name: definition.name,
        integrations: [] as AgentIntegration[],
      },
    ])
  );
  const dynamicGroups = new Map<string, BrandGroup>();

  integrations.forEach((integration) => {
    const definition = knownBrandForIntegration(integration);
    if (definition) {
      knownGroups.get(definition.id)?.integrations.push(integration);
      return;
    }

    const name = dynamicBrandName(integration);
    const id = `other-${normalize(name) || integration.id}`;
    const group = dynamicGroups.get(id) || { id, name, integrations: [] };
    group.integrations.push(integration);
    dynamicGroups.set(id, group);
  });

  return [
    ...Array.from(knownGroups.values()).filter(
      (group) => group.integrations.length > 0
    ),
    ...Array.from(dynamicGroups.values()).sort((first, second) =>
      first.name.localeCompare(second.name)
    ),
  ].map((group) => ({
    ...group,
    integrations: [...group.integrations].sort(
      (first, second) =>
        first.identifier.localeCompare(second.identifier) ||
        first.name.localeCompare(second.name)
    ),
  }));
}

export function isIntegrationSelectable(integration: AgentIntegration) {
  return !(
    integration.disabled ||
    integration.refreshNeeded ||
    integration.inBetweenSteps
  );
}

export function toggleIntegrationSelection(
  selected: AgentIntegration[],
  integration: AgentIntegration
) {
  if (!isIntegrationSelectable(integration)) {
    return selected;
  }

  if (selected.some((item) => item.id === integration.id)) {
    return selected.filter((item) => item.id !== integration.id);
  }

  return [...selected, integration];
}

export function toggleBrandSelection(
  selected: AgentIntegration[],
  integrations: AgentIntegration[]
) {
  const available = integrations.filter(isIntegrationSelectable);
  const availableIds = new Set(available.map((integration) => integration.id));
  const allSelected = available.every((integration) =>
    selected.some((item) => item.id === integration.id)
  );

  if (allSelected) {
    return selected.filter((item) => !availableIds.has(item.id));
  }

  const selectedIds = new Set(selected.map((integration) => integration.id));
  return [
    ...selected,
    ...available.filter((integration) => !selectedIds.has(integration.id)),
  ];
}

export function getBrandSelectionState(
  selected: AgentIntegration[],
  integrations: AgentIntegration[]
) {
  const available = integrations.filter(isIntegrationSelectable);
  const selectedCount = available.filter((integration) =>
    selected.some((item) => item.id === integration.id)
  ).length;

  return {
    selectedCount,
    availableCount: available.length,
    allSelected: available.length > 0 && selectedCount === available.length,
    partiallySelected: selectedCount > 0 && selectedCount < available.length,
  };
}

export function formatPlatformName(identifier: string) {
  const names: Record<string, string> = {
    gmb: 'Google Business',
    x: 'X',
    linkedin: 'LinkedIn',
    'linkedin-page': 'LinkedIn Page',
    instagram: 'Instagram',
    instagramstandalone: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    bluesky: 'Bluesky',
    threads: 'Threads',
    facebook: 'Facebook',
  };

  return (
    names[identifier.toLowerCase()] ||
    identifier
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}
