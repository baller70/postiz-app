'use client';

import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { orderBy } from 'lodash';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { PlugsContext } from '@gitroom/frontend/components/plugs/plugs.context';
import { Plug } from '@gitroom/frontend/components/plugs/plug';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  AgentIntegration,
  groupIntegrationsByBrand,
} from '@gitroom/frontend/components/agents/agent.composer.utils';
import { FiAlertTriangle, FiZap } from '@meronex/icons/fi';

type PlugDefinition = {
  name: string;
  identifier: string;
  plugs: {
    title: string;
    description: string;
    runEveryMilliseconds: number;
    methodName: string;
    fields: {
      name: string;
      type: string;
      validation: string;
      placeholder: string;
      description: string;
    }[];
  }[];
};

export const Plugs = () => {
  const fetch = useFetch();
  const router = useRouter();
  const toaster = useToaster();
  const t = useT();
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [currentId, setCurrentId] = useState('');

  const loadIntegrations = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json())
      .integrations as AgentIntegration[];
  }, [fetch]);
  const loadPlugs = useCallback(async () => {
    return (await (await fetch('/integrations/plug/list')).json()) as {
      plugs: PlugDefinition[];
    };
  }, [fetch]);

  const { data: plugList, isLoading: plugLoading } = useSWR(
    '/integrations/plug/list',
    loadPlugs,
    {
      fallbackData: { plugs: [] },
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
  const { data = [], isLoading } = useSWR(
    'plug-integration-list',
    loadIntegrations,
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

  const eligibleIntegrations = useMemo(
    () =>
      orderBy(
        data.filter((integration) =>
          plugList.plugs.some(
            (definition) => definition.identifier === integration.identifier
          )
        ),
        ['type', 'disabled', 'identifier', 'name'],
        ['desc', 'asc', 'asc', 'asc']
      ),
    [data, plugList.plugs]
  );
  const brandGroups = useMemo(
    () =>
      groupIntegrationsByBrand(eligibleIntegrations).filter(
        ({ integrations }) => integrations.length > 0
      ),
    [eligibleIntegrations]
  );
  const visibleIntegrations = useMemo(
    () =>
      selectedBrand === 'all'
        ? eligibleIntegrations
        : brandGroups.find(({ id }) => id === selectedBrand)?.integrations ||
          [],
    [brandGroups, eligibleIntegrations, selectedBrand]
  );

  useEffect(() => {
    if (!visibleIntegrations.length) {
      setCurrentId('');
      return;
    }
    if (!visibleIntegrations.some(({ id }) => id === currentId)) {
      setCurrentId(visibleIntegrations[0].id);
    }
  }, [currentId, visibleIntegrations]);

  const currentIntegration = useMemo(
    () =>
      visibleIntegrations.find(({ id }) => id === currentId) ||
      visibleIntegrations[0],
    [currentId, visibleIntegrations]
  );
  const currentIntegrationPlug = useMemo(() => {
    const definition = plugList.plugs.find(
      ({ identifier }) => identifier === currentIntegration?.identifier
    );
    if (!definition || !currentIntegration) {
      return null;
    }
    return {
      providerId: currentIntegration.id,
      ...definition,
    };
  }, [currentIntegration, plugList.plugs]);

  if (isLoading || plugLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-newBgColorInner p-[20px]">
        <LoadingComponent />
      </div>
    );
  }

  if (!eligibleIntegrations.length) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-newBgColorInner p-[20px]">
        <div className="flex max-w-[560px] flex-col items-center text-center">
          <span className="flex h-[48px] w-[48px] items-center justify-center rounded-[8px] bg-btnPrimary/10 text-btnPrimary">
            <FiZap size={23} aria-hidden="true" />
          </span>
          <h2 className="mt-[16px] text-[22px] font-[700]">
            No automation-ready channels
          </h2>
          <p className="mt-[7px] text-[13px] leading-[1.6] text-newTableText">
            Postiz channel plugs are available for X, Bluesky, LinkedIn Pages,
            and Threads.
          </p>
          <Button
            className="mt-[18px]"
            onClick={() => router.push('/launches')}
          >
            Open Launches
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-newBgColorInner p-[20px] mobile:p-[14px]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-[20px]">
        <div className="flex flex-wrap items-end justify-between gap-[12px] border-b border-newTableBorder pb-[16px]">
          <div>
            <h2 className="text-[24px] font-[700]">Channel Automations</h2>
            <p className="mt-[4px] text-[13px] text-newTableText">
              Engagement-triggered actions built into Postiz.
            </p>
          </div>
          <span className="inline-flex items-center gap-[7px] text-[12px] font-[600] text-newTableText">
            <FiZap size={15} className="text-btnPrimary" aria-hidden="true" />
            {eligibleIntegrations.length} eligible channels
          </span>
        </div>

        <section
          aria-label="Automation channel"
          className="grid grid-cols-1 gap-[12px] border-b border-newTableBorder pb-[16px] md:grid-cols-2"
        >
          <label className="flex min-w-0 flex-col gap-[6px] text-[12px] font-[600] text-newTableText">
            Brand
            <select
              value={selectedBrand}
              onChange={(event) => {
                setSelectedBrand(event.target.value);
                setCurrentId('');
              }}
              className="h-[44px] w-full rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[12px] text-[13px] text-newTextColor outline-none focus:border-btnPrimary"
            >
              <option value="all">
                All brands ({eligibleIntegrations.length})
              </option>
              {brandGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.integrations.length})
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-[6px] text-[12px] font-[600] text-newTableText">
            Channel
            <select
              value={currentIntegration?.id || ''}
              onChange={(event) => {
                const integration = visibleIntegrations.find(
                  ({ id }) => id === event.target.value
                );
                if (integration?.refreshNeeded) {
                  toaster.show(
                    'Reconnect this channel from Connections before setting a plug.',
                    'warning'
                  );
                }
                setCurrentId(event.target.value);
              }}
              className="h-[44px] w-full rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[12px] text-[13px] text-newTextColor outline-none focus:border-btnPrimary"
            >
              {visibleIntegrations.map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name} · {integration.identifier}
                </option>
              ))}
            </select>
          </label>
        </section>

        {currentIntegration?.refreshNeeded ||
        currentIntegration?.inBetweenSteps ? (
          <div
            role="status"
            className="flex items-center gap-[9px] rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-[14px] py-[11px] text-[12px] font-[600] text-amber-700 dark:text-amber-300"
          >
            <FiAlertTriangle size={16} aria-hidden="true" />
            Reconnect {currentIntegration.name} before activating automations.
          </div>
        ) : null}

        {currentIntegrationPlug ? (
          <PlugsContext.Provider value={currentIntegrationPlug}>
            <Plug />
          </PlugsContext.Provider>
        ) : (
          <div className="flex min-h-[180px] items-center justify-center text-[13px] text-newTableText">
            {t(
              'no_plugs_for_channel',
              'No plugs are available for this channel.'
            )}
          </div>
        )}
      </div>
    </main>
  );
};
