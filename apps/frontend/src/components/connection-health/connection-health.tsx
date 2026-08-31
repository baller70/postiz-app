'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiPauseCircle,
  FiRefreshCw,
  FiSearch,
} from '@meronex/icons/fi';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  ConnectionStatus,
  getConnectionStatus,
  isConnectionAttention,
} from './connection-health.utils';

interface ChannelConnection {
  id: string;
  internalId: string;
  name: string;
  display?: string | null;
  picture?: string | null;
  identifier: string;
  type: string;
  disabled?: boolean;
  refreshNeeded?: boolean;
  inBetweenSteps?: boolean;
  isCustomFields?: boolean;
  tokenExpiration?: string | null;
  updatedAt?: string | null;
  customer?: {
    id?: string;
    name?: string;
  };
}

type Filter = 'all' | 'attention' | 'connected' | 'disabled';

const statusDetails = {
  connected: {
    label: 'Connected',
    icon: FiCheckCircle,
    className:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dotClassName: 'bg-emerald-500',
  },
  reconnect: {
    label: 'Reconnect Required',
    icon: FiAlertTriangle,
    className:
      'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    dotClassName: 'bg-rose-500',
  },
  disabled: {
    label: 'Disabled',
    icon: FiPauseCircle,
    className:
      'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300',
    dotClassName: 'bg-slate-500',
  },
  expiring: {
    label: 'Expiring Soon',
    icon: FiClock,
    className:
      'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dotClassName: 'bg-amber-500',
  },
} satisfies Record<
  ConnectionStatus,
  {
    label: string;
    icon: typeof FiCheckCircle;
    className: string;
    dotClassName: string;
  }
>;

const providerNames: Record<string, string> = {
  gmb: 'Google Business Profile',
  x: 'X',
  'linkedin-page': 'LinkedIn Page',
  linkedin: 'LinkedIn Profile',
  'instagram-standalone': 'Instagram',
  'mastodon-custom': 'Mastodon',
};

function formatProvider(identifier: string) {
  if (providerNames[identifier]) {
    return providerNames[identifier];
  }

  return identifier
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function connectionTiming(integration: ChannelConnection) {
  const expiration = formatDate(integration.tokenExpiration);
  if (expiration) {
    return `Token expires ${expiration}`;
  }

  const updated = formatDate(integration.updatedAt);
  return updated ? `Connection updated ${updated}` : 'No expiry reported';
}

export const ConnectionHealth = () => {
  const fetch = useFetch();
  const router = useRouter();
  const toaster = useToaster();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const load = useCallback(
    async (path: string) => {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error('Could not load channel connections');
      }
      return (await response.json()).integrations as ChannelConnection[];
    },
    [fetch]
  );

  const {
    data = [],
    isLoading,
    error,
  } = useSWR('/integrations/list', load, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 60_000,
  });

  const channels = useMemo(
    () =>
      data.map((integration) => ({
        ...integration,
        status: getConnectionStatus(integration),
      })),
    [data]
  );

  const counts = useMemo(
    () =>
      channels.reduce(
        (summary, channel) => {
          summary[channel.status] += 1;
          return summary;
        },
        { connected: 0, reconnect: 0, disabled: 0, expiring: 0 }
      ),
    [channels]
  );

  const visibleChannels = useMemo(() => {
    const query = search.trim().toLowerCase();
    const priority: Record<ConnectionStatus, number> = {
      reconnect: 0,
      expiring: 1,
      disabled: 2,
      connected: 3,
    };

    return channels
      .filter((channel) => {
        if (filter === 'attention' && !isConnectionAttention(channel.status)) {
          return false;
        }
        if (filter === 'connected' && channel.status !== 'connected') {
          return false;
        }
        if (filter === 'disabled' && channel.status !== 'disabled') {
          return false;
        }
        if (!query) {
          return true;
        }

        return [
          channel.name,
          channel.display,
          channel.customer?.name,
          formatProvider(channel.identifier),
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .sort(
        (first, second) =>
          priority[first.status] - priority[second.status] ||
          first.name.localeCompare(second.name)
      );
  }, [channels, filter, search]);

  const reconnect = useCallback(
    async (integration: ChannelConnection) => {
      if (integration.inBetweenSteps) {
        router.push(
          `/launches?added=${integration.identifier}&continue=${integration.id}`
        );
        return;
      }

      setConnectingId(integration.id);
      try {
        const response = await fetch(
          `/integrations/social/${integration.identifier}?refresh=${integration.internalId}`
        );
        const result = await response.json();
        if (!response.ok || !result.url) {
          throw new Error('No reconnect URL was returned');
        }
        window.location.assign(result.url);
      } catch (err) {
        toaster.show(
          `Could not start the ${formatProvider(
            integration.identifier
          )} reconnect. Open Launches to manage this channel.`,
          'warning'
        );
        setConnectingId(null);
      }
    },
    [fetch, router, toaster]
  );

  if (isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  const summaries: { status: ConnectionStatus; count: number }[] = [
    { status: 'connected', count: counts.connected },
    { status: 'reconnect', count: counts.reconnect },
    { status: 'expiring', count: counts.expiring },
    { status: 'disabled', count: counts.disabled },
  ];

  return (
    <main className="bg-newBgColorInner flex-1 min-w-0 overflow-y-auto p-[20px] mobile:p-[14px]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-[20px]">
        <section
          aria-label="Connection summary"
          className="grid grid-cols-4 gap-[12px] mobile:grid-cols-2 xs:grid-cols-1"
        >
          {summaries.map(({ status, count }) => {
            const details = statusDetails[status];
            const Icon = details.icon;
            return (
              <div
                key={status}
                className="flex min-h-[92px] items-center gap-[14px] rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[16px] py-[14px]"
              >
                <div
                  className={clsx(
                    'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border',
                    details.className
                  )}
                >
                  <Icon size={21} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-[26px] font-[700] leading-none">
                    {count}
                  </div>
                  <div className="mt-[6px] text-[13px] text-newTableText">
                    {details.label}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="flex flex-wrap items-center gap-[10px] border-b border-newTableBorder pb-[16px]">
          <div
            className="flex rounded-[8px] border border-newTableBorder bg-newBgColorInner p-[3px]"
            aria-label="Filter connections"
          >
            {(
              [
                ['all', `All ${channels.length}`],
                [
                  'attention',
                  `Needs attention ${counts.reconnect + counts.expiring}`,
                ],
                ['connected', `Connected ${counts.connected}`],
                ['disabled', `Disabled ${counts.disabled}`],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={clsx(
                  'min-h-[36px] rounded-[6px] px-[12px] text-[12px] font-[600] transition-colors mobile:px-[9px]',
                  filter === value
                    ? 'bg-boxFocused text-textItemFocused'
                    : 'text-textItemBlur hover:bg-boxHover hover:text-newTextColor'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="ms-auto flex h-[42px] min-w-[260px] items-center gap-[9px] rounded-[8px] border border-newTableBorder px-[12px] mobile:ms-0 mobile:w-full mobile:min-w-0">
            <FiSearch
              size={17}
              className="text-textItemBlur"
              aria-hidden="true"
            />
            <span className="sr-only">Search connections</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search account or platform"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-textItemBlur"
            />
          </label>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-[16px] text-[14px] text-rose-600 dark:text-rose-400"
          >
            Connection health could not be loaded. Refresh this page to try
            again.
          </div>
        ) : null}

        {!error && channels.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-[12px] text-center">
            <FiExternalLink size={30} className="text-textItemBlur" />
            <div className="text-[18px] font-[600]">No channels connected</div>
            <button
              type="button"
              onClick={() => router.push('/launches')}
              className="h-[40px] rounded-[8px] bg-btnPrimary px-[16px] text-[13px] font-[600] text-white"
            >
              Open Launches
            </button>
          </div>
        ) : null}

        {!error && channels.length > 0 ? (
          <section aria-label="Channel connections" className="min-w-0">
            <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(150px,.8fr)_minmax(190px,1fr)_minmax(190px,1fr)_140px] gap-[14px] border-b border-newTableBorder px-[14px] pb-[10px] text-[11px] font-[600] uppercase text-newTableText mobile:hidden">
              <div>Account</div>
              <div>Provider</div>
              <div>Status</div>
              <div>Connection timing</div>
              <div className="text-end">Action</div>
            </div>

            <div className="divide-y divide-newTableBorder">
              {visibleChannels.map((integration) => {
                const details = statusDetails[integration.status];
                const StatusIcon = details.icon;
                const reconnecting = connectingId === integration.id;
                const canReconnect =
                  integration.status === 'reconnect' ||
                  integration.status === 'expiring';

                return (
                  <article
                    key={integration.id}
                    className="grid min-h-[82px] grid-cols-[minmax(220px,1.5fr)_minmax(150px,.8fr)_minmax(190px,1fr)_minmax(190px,1fr)_140px] items-center gap-[14px] px-[14px] py-[14px] transition-colors hover:bg-boxHover mobile:grid-cols-[minmax(0,1fr)_auto] mobile:items-start mobile:gap-x-[12px] mobile:gap-y-[8px] mobile:px-[4px]"
                  >
                    <div className="flex min-w-0 items-center gap-[12px] mobile:col-start-1 mobile:row-start-1">
                      <div className="relative h-[44px] w-[44px] shrink-0">
                        <ImageWithFallback
                          fallbackSrc="/no-picture.jpg"
                          src={integration.picture || '/no-picture.jpg'}
                          alt=""
                          width={44}
                          height={44}
                          className="h-[44px] w-[44px] rounded-[8px] object-cover"
                        />
                        <span className="absolute -bottom-[4px] -right-[4px] flex h-[21px] w-[21px] items-center justify-center rounded-full border-2 border-newBgColorInner bg-white">
                          <img
                            src={`/icons/platforms/${integration.identifier}.png`}
                            alt={`${formatProvider(
                              integration.identifier
                            )} icon`}
                            width={15}
                            height={15}
                            className="h-[15px] w-[15px] object-contain"
                          />
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-[600]">
                          {integration.name}
                        </div>
                        <div className="mt-[3px] truncate text-[12px] text-newTableText">
                          {integration.customer?.name ||
                            integration.display ||
                            integration.type}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 text-[13px] mobile:col-start-1 mobile:row-start-2 mobile:ps-[56px]">
                      {formatProvider(integration.identifier)}
                    </div>

                    <div className="mobile:col-start-1 mobile:row-start-3 mobile:ps-[56px]">
                      <span
                        className={clsx(
                          'inline-flex min-h-[32px] items-center gap-[7px] rounded-full border px-[10px] text-[12px] font-[600]',
                          details.className
                        )}
                      >
                        <StatusIcon size={15} aria-hidden="true" />
                        {details.label}
                      </span>
                    </div>

                    <div className="text-[12px] text-newTableText mobile:col-start-1 mobile:row-start-4 mobile:ps-[56px]">
                      {connectionTiming(integration)}
                    </div>

                    <div className="flex justify-end mobile:col-start-2 mobile:row-span-4 mobile:row-start-1 mobile:self-center">
                      {canReconnect ? (
                        <button
                          type="button"
                          onClick={() => reconnect(integration)}
                          disabled={reconnecting}
                          aria-label={`Reconnect ${integration.name}`}
                          className="flex h-[38px] min-w-[124px] items-center justify-center gap-[7px] rounded-[8px] bg-btnPrimary px-[12px] text-[12px] font-[600] text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 mobile:w-[38px] mobile:min-w-[38px] mobile:px-0"
                        >
                          <FiRefreshCw
                            size={15}
                            className={clsx(reconnecting && 'animate-spin')}
                            aria-hidden="true"
                          />
                          <span className="mobile:hidden">
                            {reconnecting ? 'Opening...' : 'Reconnect'}
                          </span>
                        </button>
                      ) : integration.status === 'disabled' ? (
                        <button
                          type="button"
                          onClick={() => router.push('/launches')}
                          aria-label={`Manage ${integration.name} in Launches`}
                          className="flex h-[38px] min-w-[124px] items-center justify-center gap-[7px] rounded-[8px] border border-newTableBorder px-[12px] text-[12px] font-[600] text-newTableText hover:bg-boxHover hover:text-newTextColor mobile:w-[38px] mobile:min-w-[38px] mobile:px-0"
                        >
                          <FiExternalLink size={14} aria-hidden="true" />
                          <span className="mobile:hidden">Manage</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-[7px] text-[12px] font-[600] text-emerald-600 dark:text-emerald-400">
                          <span
                            className={clsx(
                              'h-[8px] w-[8px] rounded-full',
                              details.dotClassName
                            )}
                          />
                          <span className="mobile:hidden">Ready</span>
                          <span className="sr-only">Ready to publish</span>
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {visibleChannels.length === 0 ? (
              <div className="flex min-h-[180px] items-center justify-center text-[14px] text-newTableText">
                No connections match this view.
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
};
