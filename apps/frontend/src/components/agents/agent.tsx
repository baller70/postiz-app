'use client';

import React, {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import clsx from 'clsx';
import useSWR from 'swr';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  CheckmarkIcon,
  CloseIcon,
  DelayIcon,
  GlobalIcon,
  PlusIcon,
} from '@gitroom/frontend/components/ui/icons';
import {
  AgentIntegration,
  BrandGroup,
  formatPlatformName,
  getBrandSelectionState,
  groupIntegrationsByBrand,
  isIntegrationSelectable,
  toggleBrandSelection,
  toggleIntegrationSelection,
} from '@gitroom/frontend/components/agents/agent.composer.utils';

type PropertiesContextValue = {
  properties: AgentIntegration[];
  integrations: AgentIntegration[];
  groups: BrandGroup[];
  isLoading: boolean;
  error?: Error;
  setProperties: React.Dispatch<React.SetStateAction<AgentIntegration[]>>;
};

export const PropertiesContext = createContext<PropertiesContextValue>({
  properties: [],
  integrations: [],
  groups: [],
  isLoading: false,
  setProperties: () => undefined,
});

const SelectionMark: FC<{
  selected: boolean;
  partial?: boolean;
  disabled?: boolean;
}> = ({ selected, partial, disabled }) => (
  <span
    className={clsx(
      'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors',
      selected || partial
        ? 'border-btnPrimary bg-btnPrimary text-white'
        : 'border-newBorder bg-newBgColor',
      disabled && 'opacity-40'
    )}
    aria-hidden
  >
    {partial ? (
      <span className="h-[2px] w-[8px] rounded-full bg-white" />
    ) : selected ? (
      <CheckmarkIcon className="h-[12px] w-[12px]" />
    ) : null}
  </span>
);

const AgentList: FC<{
  className?: string;
  onSelect?: () => void;
}> = ({ className, onSelect }) => {
  const t = useT();
  const { properties, groups, isLoading, error, setProperties } =
    React.useContext(PropertiesContext);

  const selectedIds = useMemo(
    () => new Set(properties.map((integration) => integration.id)),
    [properties]
  );

  const toggleIntegration = useCallback(
    (integration: AgentIntegration) => {
      setProperties((current) =>
        toggleIntegrationSelection(current, integration)
      );
    },
    [setProperties]
  );

  const toggleBrand = useCallback(
    (integrations: AgentIntegration[]) => {
      setProperties((current) => toggleBrandSelection(current, integrations));
    },
    [setProperties]
  );

  return (
    <aside
      className={clsx(
        'min-h-0 w-full flex-col border-e border-newBorder bg-newBgColorInner xl:w-[276px]',
        className
      )}
      aria-label={t('publishing_targets', 'Publishing targets')}
    >
      <div className="flex min-h-[68px] items-center justify-between border-b border-newBorder px-[18px]">
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-[600]">
            {t('publishing_targets', 'Publishing targets')}
          </h2>
          <p className="mt-[2px] text-[12px] text-textItemBlur">
            {properties.length}{' '}
            {properties.length === 1
              ? t('channel_attached', 'channel attached')
              : t('channels_attached', 'channels attached')}
          </p>
        </div>
        {onSelect && (
          <button
            type="button"
            onClick={onSelect}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-[6px] text-textItemBlur hover:bg-boxHover hover:text-newTextColor"
            aria-label={t('close', 'Close')}
          >
            <CloseIcon className="h-[16px] w-[16px]" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[12px] py-[12px] scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        {isLoading && (
          <div className="px-[6px] py-[20px] text-[13px] text-textItemBlur">
            {t('loading_channels', 'Loading channels...')}
          </div>
        )}
        {error && (
          <div className="px-[6px] py-[20px] text-[13px] text-red-400">
            {t('channels_unavailable', 'Channels are unavailable')}
          </div>
        )}
        {!isLoading && !error && groups.length === 0 && (
          <div className="px-[6px] py-[20px] text-[13px] text-textItemBlur">
            {t('no_channels', 'No channels connected')}
          </div>
        )}

        <div className="flex flex-col gap-[8px]">
          {groups.map((group) => {
            const selection = getBrandSelectionState(
              properties,
              group.integrations
            );
            const brandDisabled = selection.availableCount === 0;

            return (
              <section
                key={group.id}
                className="border-b border-newBorder pb-[8px] last:border-b-0"
              >
                <button
                  type="button"
                  className="flex min-h-[42px] w-full items-center gap-[9px] rounded-[6px] px-[6px] text-start hover:bg-boxHover disabled:cursor-not-allowed"
                  onClick={() => toggleBrand(group.integrations)}
                  disabled={brandDisabled}
                  role="checkbox"
                  aria-checked={
                    selection.partiallySelected
                      ? 'mixed'
                      : selection.allSelected
                  }
                  aria-label={`${group.name}: ${selection.selectedCount} of ${selection.availableCount} attached`}
                >
                  <SelectionMark
                    selected={selection.allSelected}
                    partial={selection.partiallySelected}
                    disabled={brandDisabled}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-[600]">
                    {group.name}
                  </span>
                  <span className="text-[11px] text-textItemBlur">
                    {selection.selectedCount}/{selection.availableCount}
                  </span>
                </button>

                <div className="ms-[14px] border-s border-newBorder ps-[8px]">
                  {group.integrations.length === 0 ? (
                    <div className="px-[6px] py-[9px] text-[11px] text-textItemBlur">
                      {t('no_channels_connected', 'No channels connected')}
                    </div>
                  ) : null}
                  {group.integrations.map((integration) => {
                    const selected = selectedIds.has(integration.id);
                    const selectable = isIntegrationSelectable(integration);
                    const platform = formatPlatformName(integration.identifier);

                    return (
                      <button
                        type="button"
                        key={integration.id}
                        onClick={() => toggleIntegration(integration)}
                        disabled={!selectable}
                        className={clsx(
                          'group flex min-h-[44px] w-full items-center gap-[8px] rounded-[6px] px-[6px] text-start transition-colors',
                          selected
                            ? 'bg-btnPrimary/10 text-newTextColor'
                            : 'hover:bg-boxHover',
                          !selectable && 'cursor-not-allowed opacity-50'
                        )}
                        aria-pressed={selected}
                        title={
                          selectable
                            ? `${integration.name} - ${platform}`
                            : `${integration.name} - reconnect required`
                        }
                      >
                        <SelectionMark
                          selected={selected}
                          disabled={!selectable}
                        />
                        <span className="relative h-[30px] w-[30px] shrink-0">
                          <ImageWithFallback
                            fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
                            src={integration.picture || '/no-picture.jpg'}
                            className="h-[30px] w-[30px] rounded-[6px] object-cover"
                            alt=""
                            width={30}
                            height={30}
                          />
                          <SafeImage
                            src={`/icons/platforms/${integration.identifier}.png`}
                            className="absolute -bottom-[3px] -end-[3px] z-10 h-[14px] w-[14px] rounded-[4px] border border-fifth bg-newBgColorInner"
                            alt=""
                            width={14}
                            height={14}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-[500]">
                            {platform}
                          </span>
                          <span className="block truncate text-[10px] text-textItemBlur">
                            {selectable
                              ? selected
                                ? t('attached_to_draft', 'Attached to draft')
                                : integration.name
                              : t('reconnect_required', 'Reconnect required')}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

type Thread = {
  id: string;
  title: string;
};

const Threads: FC<{
  className?: string;
  onSelect?: () => void;
}> = ({ className, onSelect }) => {
  const fetch = useFetch();
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const loadThreads = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not load conversations');
    }
    return (await response.json()) as { threads?: Thread[] };
  }, []);
  const { data, isLoading } = useSWR('/copilot/list', loadThreads);

  return (
    <aside
      className={clsx(
        'min-h-0 w-full flex-col border-s border-newBorder bg-newBgColorInner xl:w-[240px]',
        className
      )}
      aria-label={t('conversation_history', 'Conversation history')}
    >
      <div className="flex min-h-[68px] items-center justify-between border-b border-newBorder px-[16px]">
        <div>
          <h2 className="text-[15px] font-[600]">{t('history', 'History')}</h2>
          <p className="mt-[2px] text-[11px] text-textItemBlur">
            {data?.threads?.length || 0} {t('conversations', 'conversations')}
          </p>
        </div>
        {onSelect && (
          <button
            type="button"
            onClick={onSelect}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-[6px] text-textItemBlur hover:bg-boxHover hover:text-newTextColor"
            aria-label={t('close', 'Close')}
          >
            <CloseIcon className="h-[16px] w-[16px]" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-[10px] py-[12px] scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <Link
          href="/agents/new"
          onClick={onSelect}
          className="mb-[10px] flex min-h-[40px] items-center justify-center gap-[7px] rounded-[6px] bg-btnPrimary px-[12px] text-[13px] font-[600] text-white"
        >
          <PlusIcon className="h-[16px] w-[16px]" />
          {t('new_chat', 'New chat')}
        </Link>
        {isLoading ? (
          <div className="px-[8px] py-[16px] text-[12px] text-textItemBlur">
            {t('loading_history', 'Loading history...')}
          </div>
        ) : (
          <div className="flex flex-col gap-[2px]">
            {data?.threads?.map((thread) => (
              <Link
                className={clsx(
                  'overflow-hidden text-ellipsis whitespace-nowrap rounded-[6px] px-[9px] py-[8px] text-[12px] text-textItemBlur hover:bg-boxHover hover:text-newTextColor',
                  thread.id === id &&
                    'bg-newBgColor text-newTextColor shadow-[inset_2px_0_0_var(--new-btn-text)]'
                )}
                href={`/agents/${thread.id}`}
                onClick={onSelect}
                key={thread.id}
                title={thread.title}
              >
                {thread.title}
              </Link>
            ))}
            {!data?.threads?.length && (
              <div className="px-[8px] py-[16px] text-[12px] text-textItemBlur">
                {t('no_conversations', 'No conversations yet')}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export const Agent: FC<{ children: ReactNode }> = ({ children }) => {
  const fetch = useFetch();
  const t = useT();
  const [properties, setProperties] = useState<AgentIntegration[]>([]);
  const [mobilePanel, setMobilePanel] = useState<'targets' | 'history' | null>(
    null
  );

  const loadIntegrations = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not load channel integrations');
    }
    return ((await response.json()).integrations || []) as AgentIntegration[];
  }, []);

  const {
    data: integrations = [],
    isLoading,
    error,
  } = useSWR('/integrations/list', loadIntegrations, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  useEffect(() => {
    setProperties((current) =>
      current
        .map((selected) =>
          integrations.find((integration) => integration.id === selected.id)
        )
        .filter(
          (integration): integration is AgentIntegration =>
            !!integration && isIntegrationSelectable(integration)
        )
    );
  }, [integrations]);

  const groups = useMemo(
    () => groupIntegrationsByBrand(integrations),
    [integrations]
  );

  const contextValue = useMemo(
    () => ({
      properties,
      integrations,
      groups,
      isLoading,
      error,
      setProperties,
    }),
    [properties, integrations, groups, isLoading, error]
  );

  return (
    <PropertiesContext.Provider value={contextValue}>
      <div className="absolute inset-0 flex min-h-0 min-w-0 overflow-hidden bg-newBgLineColor">
        <AgentList className="hidden xl:flex" />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-newBgColorInner">
          <div className="flex min-h-[49px] items-center gap-[8px] border-b border-newBorder px-[12px] xl:hidden">
            <button
              type="button"
              onClick={() =>
                setMobilePanel((current) =>
                  current === 'targets' ? null : 'targets'
                )
              }
              className={clsx(
                'flex h-[34px] items-center gap-[7px] rounded-[6px] px-[10px] text-[12px] font-[600]',
                mobilePanel === 'targets'
                  ? 'bg-btnPrimary text-white'
                  : 'bg-newBgColor text-newTextColor'
              )}
              aria-expanded={mobilePanel === 'targets'}
            >
              <GlobalIcon className="h-[16px] w-[16px]" />
              {t('targets', 'Targets')}
              <span className="rounded-[4px] bg-black/15 px-[5px] py-[1px] text-[10px]">
                {properties.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                setMobilePanel((current) =>
                  current === 'history' ? null : 'history'
                )
              }
              className={clsx(
                'flex h-[34px] items-center gap-[7px] rounded-[6px] px-[10px] text-[12px] font-[600]',
                mobilePanel === 'history'
                  ? 'bg-btnPrimary text-white'
                  : 'bg-newBgColor text-newTextColor'
              )}
              aria-expanded={mobilePanel === 'history'}
            >
              <DelayIcon className="h-[16px] w-[16px]" />
              {t('history', 'History')}
            </button>
          </div>

          {mobilePanel && (
            <div className="absolute inset-x-0 bottom-0 top-[49px] z-40 flex bg-black/25 xl:hidden">
              {mobilePanel === 'targets' ? (
                <AgentList
                  className="flex max-w-[340px] shadow-xl"
                  onSelect={() => setMobilePanel(null)}
                />
              ) : (
                <Threads
                  className="ms-auto flex max-w-[320px] shadow-xl"
                  onSelect={() => setMobilePanel(null)}
                />
              )}
              <button
                type="button"
                className="min-w-[24px] flex-1 cursor-default"
                aria-label={t('close', 'Close')}
                onClick={() => setMobilePanel(null)}
              />
            </div>
          )}

          {children}
        </div>
        <Threads className="hidden xl:flex" />
      </div>
    </PropertiesContext.Provider>
  );
};
