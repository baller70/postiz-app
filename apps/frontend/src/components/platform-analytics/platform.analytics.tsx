'use client';

import { Integration } from '@prisma/client';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiPauseCircle,
} from '@meronex/icons/fi';
import { capitalize, orderBy } from 'lodash';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  ALL_BRANDS,
  AnalyticsIntegrationIdentity,
  buildAnalyticsBrandSections,
  filterAnalyticsBrandSections,
  getAnalyticsDateRanges,
  getAnalyticsStatusTotals,
} from '@gitroom/frontend/components/platform-analytics/brand.analytics.utils';
import { RenderAnalytics } from '@gitroom/frontend/components/platform-analytics/render.analytics';
import {
  ConnectionStatus,
  formatProvider,
  getConnectionStatus,
} from '@gitroom/frontend/components/connection-health/connection-health.utils';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { Select } from '@gitroom/react/form/select';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const allowedIntegrations = [
  'facebook',
  'instagram',
  'instagram-standalone',
  'linkedin-page',
  'tiktok',
  'youtube',
  'gmb',
  'pinterest',
  'threads',
  'x',
];

type AnalyticsIntegration = Integration &
  AnalyticsIntegrationIdentity & {
    picture: string;
    identifier: string;
    internalId: string;
    inBetweenSteps?: boolean;
  };

const statusDetails: Record<
  ConnectionStatus,
  { label: string; className: string }
> = {
  connected: {
    label: 'Connected',
    className:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  reconnect: {
    label: 'Reconnect required',
    className:
      'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  expiring: {
    label: 'Reconnect soon',
    className:
      'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  disabled: {
    label: 'Disabled',
    className: 'border-newTableBorder bg-boxHover text-newTableText',
  },
};

function StatusIcon({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') return <FiCheckCircle size={15} aria-hidden />;
  if (status === 'reconnect') return <FiAlertTriangle size={15} aria-hidden />;
  if (status === 'expiring') return <FiClock size={15} aria-hidden />;
  return <FiPauseCircle size={15} aria-hidden />;
}

function ConnectionStatusPill({ status }: { status: ConnectionStatus }) {
  const details = statusDetails[status];
  return (
    <span
      className={`inline-flex min-h-[30px] max-w-full items-center gap-[7px] rounded-[7px] border px-[10px] text-[12px] font-[600] ${details.className}`}
    >
      <StatusIcon status={status} />
      <span className="truncate">{details.label}</span>
    </span>
  );
}

function DisabledAnalyticsState() {
  return (
    <div className="flex min-h-[150px] items-center justify-center border-t border-newTableBorder px-[20px] py-[36px] text-center">
      <div className="flex max-w-[420px] flex-col items-center gap-[8px] text-newTableText">
        <FiPauseCircle size={24} aria-hidden />
        <div className="text-[15px] font-[600] text-newTextColor">
          Channel disabled
        </div>
        <div className="text-[13px]">
          Enable this existing connection before loading its analytics.
        </div>
      </div>
    </div>
  );
}

export const PlatformAnalytics = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const { disableXAnalytics } = useVariables();
  const [activeBrand, setActiveBrand] = useState(ALL_BRANDS);
  const [dateRange, setDateRange] = useState(7);

  const load = useCallback(async () => {
    const response = await (await fetch('/integrations/list')).json();
    return response.integrations.filter((integration: AnalyticsIntegration) => {
      if (integration.identifier === 'x' && disableXAnalytics) {
        return false;
      }
      return allowedIntegrations.includes(integration.identifier);
    });
  }, [disableXAnalytics, fetch]);

  const { data = [], isLoading } = useSWR<AnalyticsIntegration[]>(
    'analytics-list',
    load,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      fallbackData: [],
    }
  );

  const sortedIntegrations = useMemo(
    () =>
      orderBy(data, ['type', 'disabled', 'identifier'], ['desc', 'asc', 'asc']),
    [data]
  );
  const brandSections = useMemo(
    () => buildAnalyticsBrandSections(sortedIntegrations),
    [sortedIntegrations]
  );
  const visibleSections = useMemo(
    () => filterAnalyticsBrandSections(brandSections, activeBrand),
    [activeBrand, brandSections]
  );
  const visibleIntegrations = useMemo(
    () => visibleSections.flatMap(({ integrations }) => integrations),
    [visibleSections]
  );
  const dateRanges = useMemo(
    () => getAnalyticsDateRanges(visibleIntegrations),
    [visibleIntegrations]
  );
  const selectedDateRange = dateRanges.includes(dateRange)
    ? dateRange
    : dateRanges[0];
  const totals = useMemo(
    () => getAnalyticsStatusTotals(visibleIntegrations),
    [visibleIntegrations]
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-newBgColorInner p-[20px]">
        <LoadingComponent />
      </div>
    );
  }

  if (!sortedIntegrations.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[15px] bg-newBgColorInner p-[20px] text-center">
        <img src="/peoplemarketplace.svg" alt="" />
        <div className="text-[32px] font-[600] sm:text-[40px]">
          {t('can_t_show_analytics_yet', "Can't show analytics yet")}
        </div>
        <div className="text-[16px] text-newTableText">
          {t(
            'you_have_to_add_social_media_channels',
            'You have to add Social Media channels'
          )}
        </div>
        <div className="text-[14px] text-newTableText">
          {t('supported', 'Supported:')}{' '}
          {allowedIntegrations.map(capitalize).join(', ')}
        </div>
        <Button onClick={() => router.push('/launches')}>
          {t(
            'go_to_the_calendar_to_add_channels',
            'Go to the calendar to add channels'
          )}
        </Button>
      </div>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-newBgColorInner">
      <div className="sticky top-0 z-20 border-b border-newTableBorder bg-newBgColorInner px-[16px] py-[16px] sm:px-[20px]">
        <div className="flex flex-col gap-[14px] xl:flex-row xl:items-end xl:justify-between">
          <div className="grid w-full grid-cols-1 gap-[12px] sm:grid-cols-2 xl:max-w-[620px]">
            <Select
              label="Brand"
              name="brand"
              value={activeBrand}
              disableForm
              hideErrors
              onChange={(event) => setActiveBrand(event.target.value)}
            >
              <option value={ALL_BRANDS}>
                All Brands ({sortedIntegrations.length} channels)
              </option>
              {brandSections.map((section) => (
                <option key={section.key} value={section.key}>
                  {section.label} ({section.integrations.length})
                </option>
              ))}
            </Select>

            <Select
              label="Date range"
              name="date"
              value={selectedDateRange}
              disableForm
              hideErrors
              onChange={(event) => setDateRange(Number(event.target.value))}
            >
              {dateRanges.map((range) => (
                <option key={range} value={range}>
                  {range} Days
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[8px] text-[12px] font-[600] text-newTableText">
            <span className="inline-flex items-center gap-[6px] text-emerald-600 dark:text-emerald-400">
              <FiCheckCircle size={15} aria-hidden />
              {totals.connected} connected
            </span>
            {totals.reconnect + totals.expiring > 0 ? (
              <span className="inline-flex items-center gap-[6px] text-rose-600 dark:text-rose-400">
                <FiAlertTriangle size={15} aria-hidden />
                {totals.reconnect + totals.expiring} need attention
              </span>
            ) : null}
            {totals.disabled > 0 ? (
              <span className="inline-flex items-center gap-[6px]">
                <FiPauseCircle size={15} aria-hidden />
                {totals.disabled} disabled
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        {visibleSections.map((section) => (
          <section key={section.key} aria-labelledby={`brand-${section.key}`}>
            <div className="flex items-center justify-between border-b border-newTableBorder px-[16px] py-[14px] sm:px-[20px]">
              <h2
                id={`brand-${section.key}`}
                className="min-w-0 truncate text-[18px] font-[700]"
              >
                {section.label}
              </h2>
              <span className="whitespace-nowrap text-[12px] text-newTableText">
                {section.integrations.length}{' '}
                {section.integrations.length === 1 ? 'channel' : 'channels'}
              </span>
            </div>

            {section.integrations.map((integration) => {
              const status = getConnectionStatus(integration);
              return (
                <article
                  key={integration.id}
                  className="border-b border-newTableBorder px-[16px] py-[18px] sm:px-[20px] sm:py-[20px]"
                >
                  <div className="mb-[16px] flex flex-col gap-[12px] sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-[12px]">
                      <div className="relative shrink-0">
                        <ImageWithFallback
                          fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
                          src={integration.picture || '/no-picture.jpg'}
                          className="h-[42px] w-[42px] rounded-[8px] object-cover"
                          alt=""
                          width={42}
                          height={42}
                        />
                        <SafeImage
                          src={`/icons/platforms/${integration.identifier}.png`}
                          className="absolute -bottom-[4px] -end-[4px] z-10 rounded-[5px] border border-newTableBorder bg-newBgColorInner"
                          alt=""
                          width={19}
                          height={19}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-[600]">
                          {integration.name ||
                            integration.display ||
                            'Unnamed channel'}
                        </div>
                        <div className="mt-[2px] text-[12px] text-newTableText">
                          {formatProvider(integration.identifier)}
                        </div>
                      </div>
                    </div>
                    <ConnectionStatusPill status={status} />
                  </div>

                  {status === 'disabled' ? (
                    <DisabledAnalyticsState />
                  ) : (
                    <RenderAnalytics
                      integration={integration}
                      date={selectedDateRange}
                    />
                  )}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </main>
  );
};
