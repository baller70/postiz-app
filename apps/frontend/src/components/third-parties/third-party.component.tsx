'use client';

import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ThirdPartyListComponent } from '@gitroom/frontend/components/third-parties/third-party.list.component';
import React, { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import Link from 'next/link';
import {
  FiCheckCircle,
  FiCode,
  FiCpu,
  FiExternalLink,
  FiGitBranch,
  FiMoreHorizontal,
  FiRadio,
  FiShare2,
  FiZap,
} from '@meronex/icons/fi';

type SavedThirdParty = {
  id: string;
  identifier: string;
  title: string;
  name: string;
  description: string;
};

const workflowConnectors = [
  {
    id: 'n8n',
    title: 'n8n',
    badge: 'Recommended',
    description:
      'Build durable content pipelines with the official Postiz community node.',
    detail: 'Automation',
    href: 'https://n8n.io/integrations/postiz/',
    action: 'Open n8n connector',
    icon: FiGitBranch,
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  {
    id: 'make',
    title: 'Make',
    badge: 'Popular',
    description:
      'Connect Postiz to Airtable, Google Drive, Sheets, approvals, and other marketing tools.',
    detail: 'No-code workflows',
    href: 'https://www.make.com/en/integrations/postiz',
    action: 'Open Make connector',
    icon: FiShare2,
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  {
    id: 'mcp',
    title: 'Postiz MCP',
    badge: 'Official',
    description:
      'Let Codex and other MCP clients list channels, generate media, and schedule posts.',
    detail: 'AI agents',
    href: 'https://docs.postiz.com/mcp/introduction',
    action: 'Open MCP setup',
    icon: FiCpu,
    color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  },
  {
    id: 'api',
    title: 'Public API',
    badge: 'Official',
    description:
      'Use your private API key for custom apps, scheduled imports, and internal tools.',
    detail: 'Developer',
    href: '/settings?tab=api',
    action: 'Open API settings',
    icon: FiCode,
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    badge: 'Built in',
    description:
      'Send publishing events to reporting, alerts, approvals, or downstream workflows.',
    detail: 'Notifications',
    href: '/settings?tab=webhooks',
    action: 'Manage webhooks',
    icon: FiRadio,
    color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'sdk',
    title: 'Node.js SDK',
    badge: 'Official',
    description:
      'Schedule posts, upload media, and read connected channels from Node.js applications.',
    detail: 'Developer',
    href: 'https://www.npmjs.com/package/@postiz/node',
    action: 'Open SDK',
    icon: FiCode,
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    id: 'zapier',
    title: 'Zapier',
    badge: 'API bridge',
    description:
      'Use Webhooks by Zapier with the Postiz API when a Zapier-first workflow is required.',
    detail: 'No native Postiz app',
    href: 'https://zapier.com/apps/webhook/integrations',
    action: 'Open Zapier webhooks',
    icon: FiZap,
    color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  },
] as const;

export const ThirdPartyMenuComponent: FC<{
  reload: () => void;
  tParty: { id: string };
}> = ({ tParty, reload }) => {
  const fetch = useFetch();
  const [show, setShow] = useState(false);
  const toaster = useToaster();

  const deleteChannel = async () => {
    setShow(false);
    if (!(await deleteDialog('Delete this integration?'))) {
      return;
    }

    const response = await fetch(`/third-party/${tParty.id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      toaster.show('Integration deleted successfully', 'success');
      reload();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShow((current) => !current)}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[7px] text-newTableText hover:bg-boxHover hover:text-newTextColor"
        aria-label="Integration actions"
        aria-expanded={show}
      >
        <FiMoreHorizontal size={18} aria-hidden="true" />
      </button>
      {show ? (
        <button
          type="button"
          onClick={deleteChannel}
          className="absolute end-0 top-[38px] z-20 w-[150px] rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[12px] py-[10px] text-start text-[12px] font-[600] text-rose-600 shadow-lg dark:text-rose-400"
        >
          Delete integration
        </button>
      ) : null}
    </div>
  );
};

const WorkflowCatalog = () => (
  <section aria-labelledby="workflow-connectors-heading">
    <div className="mb-[12px] flex flex-wrap items-end justify-between gap-[8px]">
      <div>
        <h2 id="workflow-connectors-heading" className="text-[20px] font-[700]">
          Workflow connectors
        </h2>
        <p className="mt-[3px] text-[13px] text-newTableText">
          Official Postiz tools and widely used automation bridges.
        </p>
      </div>
      <span className="text-[12px] font-[600] text-newTableText">
        {workflowConnectors.length} available
      </span>
    </div>

    <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 2xl:grid-cols-3">
      {workflowConnectors.map((connector) => {
        const Icon = connector.icon;
        const external = connector.href.startsWith('http');
        const content = (
          <>
            <div className="flex items-start gap-[12px]">
              <span
                className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[8px] ${connector.color}`}
              >
                <Icon size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-[7px]">
                  <h3 className="text-[15px] font-[700]">{connector.title}</h3>
                  <span className="rounded-full bg-boxHover px-[7px] py-[2px] text-[10px] font-[700] text-newTableText">
                    {connector.badge}
                  </span>
                </div>
                <div className="mt-[3px] text-[11px] font-[600] uppercase text-newTableText">
                  {connector.detail}
                </div>
              </div>
            </div>
            <p className="mt-[13px] flex-1 text-[13px] leading-[1.55] text-newTableText">
              {connector.description}
            </p>
            <span className="mt-[14px] inline-flex items-center gap-[7px] text-[12px] font-[700] text-btnPrimary">
              {connector.action}
              {external ? (
                <FiExternalLink size={14} aria-hidden="true" />
              ) : null}
            </span>
          </>
        );

        const className =
          'flex min-h-[196px] flex-col rounded-[8px] border border-newTableBorder bg-newBgColorInner p-[16px] transition-colors hover:border-newTextColor/30 hover:bg-boxHover';

        return external ? (
          <a
            key={connector.id}
            href={connector.href}
            target="_blank"
            rel="noreferrer"
            className={className}
          >
            {content}
          </a>
        ) : (
          <Link key={connector.id} href={connector.href} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  </section>
);

export const ThirdPartyComponent = () => {
  const fetch = useFetch();
  const t = useT();

  const integrations = useCallback(async () => {
    return (await fetch('/third-party')).json();
  }, [fetch]);

  const {
    data = [],
    isLoading,
    mutate,
  } = useSWR<SavedThirdParty[]>('third-party', integrations, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });
  const connectedIdentifiers = useMemo(
    () => data.map(({ identifier }) => identifier),
    [data]
  );

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-newBgColorInner p-[20px] mobile:p-[14px]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-[28px]">
        <div className="flex flex-wrap items-end justify-between gap-[12px] border-b border-newTableBorder pb-[16px]">
          <div>
            <h2 className="text-[24px] font-[700]">Integration Hub</h2>
            <p className="mt-[4px] max-w-[720px] text-[13px] text-newTableText">
              Native media services and proven workflow connectors for Postiz.
            </p>
          </div>
          <div className="inline-flex items-center gap-[7px] text-[12px] font-[600] text-newTableText">
            <FiCheckCircle
              size={16}
              className="text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            {data.length} connected
          </div>
        </div>

        {data.length ? (
          <section aria-labelledby="connected-integrations-heading">
            <div className="mb-[10px] flex items-center justify-between">
              <h2
                id="connected-integrations-heading"
                className="text-[20px] font-[700]"
              >
                Connected
              </h2>
              <span className="text-[12px] text-newTableText">
                {data.length} active
              </span>
            </div>
            <div className="divide-y divide-newTableBorder border-y border-newTableBorder">
              {data.map((integration) => (
                <div
                  key={integration.id}
                  className="flex min-h-[68px] items-center gap-[12px] px-[6px] py-[10px]"
                >
                  <ImageWithFallback
                    fallbackSrc={`/icons/third-party/${integration.identifier}.png`}
                    src={`/icons/third-party/${integration.identifier}.png`}
                    alt=""
                    width={38}
                    height={38}
                    className="h-[38px] w-[38px] rounded-[8px] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-[700]">
                      {integration.name || integration.title}
                    </div>
                    <div className="mt-[2px] truncate text-[12px] text-newTableText">
                      {integration.title}
                    </div>
                  </div>
                  <span className="hidden items-center gap-[6px] text-[11px] font-[700] text-emerald-600 sm:inline-flex dark:text-emerald-400">
                    <FiCheckCircle size={14} aria-hidden="true" />
                    Connected
                  </span>
                  <ThirdPartyMenuComponent
                    tParty={integration}
                    reload={mutate}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <ThirdPartyListComponent
          reload={mutate}
          connectedIdentifiers={connectedIdentifiers}
        />
        <WorkflowCatalog />

        {!isLoading && !data.length ? (
          <p className="sr-only">
            {t('no_integrations_yet', 'No integrations connected yet')}
          </p>
        ) : null}
      </div>
    </main>
  );
};
