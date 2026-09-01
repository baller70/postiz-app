'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import React, { FC, useCallback, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { FiCheckCircle, FiPlus } from '@meronex/icons/fi';

type ThirdPartyDefinition = {
  identifier: string;
  title: string;
  description: string;
};

export const ApiModal: FC<{
  identifier: string;
  title: string;
  update: () => void;
}> = ({ title, identifier, update }) => {
  const fetch = useFetch();
  const router = useRouter();
  const modal = useModals();
  const toaster = useToaster();
  const [loading, setLoading] = useState(false);
  const methods = useForm({ mode: 'onChange' });

  const submit = useCallback(
    async (data: FieldValues) => {
      setLoading(true);
      const response = await fetch(`/third-party/${identifier}`, {
        method: 'POST',
        body: JSON.stringify({ api: data.api }),
      });

      if (response.ok) {
        toaster.show('Integration added successfully', 'success');
        modal.closeAll();
        router.refresh();
        update();
        return;
      }

      const { message } = await response.json();
      methods.setError('api', { message });
      setLoading(false);
    },
    [fetch, identifier, methods, modal, router, toaster, update]
  );

  return (
    <div className="relative">
      <FormProvider {...methods}>
        <form
          className="flex flex-col gap-[12px]"
          onSubmit={methods.handleSubmit(submit)}
        >
          <div className="pt-[8px]">
            <Input label={`${title} API key`} name="api" type="password" />
          </div>
          <Button loading={loading} type="submit">
            Connect {title}
          </Button>
        </form>
      </FormProvider>
    </div>
  );
};

export const ThirdPartyListComponent: FC<{
  reload: () => void;
  connectedIdentifiers?: string[];
}> = ({ reload, connectedIdentifiers = [] }) => {
  const fetch = useFetch();
  const modals = useModals();
  const t = useT();

  const integrationsList = useCallback(async () => {
    return (await fetch('/third-party/list')).json();
  }, [fetch]);

  const { data = [], isLoading } = useSWR<ThirdPartyDefinition[]>(
    'third-party-list',
    integrationsList,
    {
      fallbackData: [],
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const addApiKey = useCallback(
    (title: string, identifier: string) => () => {
      modals.openModal({
        title: `Connect ${title}`,
        withCloseButton: true,
        children: (
          <ApiModal identifier={identifier} title={title} update={reload} />
        ),
      });
    },
    [modals, reload]
  );

  return (
    <section aria-labelledby="native-integrations-heading">
      <div className="mb-[12px] flex flex-wrap items-end justify-between gap-[8px]">
        <div>
          <h2
            id="native-integrations-heading"
            className="text-[20px] font-[700]"
          >
            Native media integrations
          </h2>
          <p className="mt-[3px] text-[13px] text-newTableText">
            Services implemented directly in this Postiz installation.
          </p>
        </div>
        <span className="text-[12px] font-[600] text-newTableText">
          {isLoading ? 'Loading' : `${data.length} available`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-3">
        {data.map((integration) => {
          const connected = connectedIdentifiers.includes(
            integration.identifier
          );
          return (
            <article
              key={integration.identifier}
              className="flex min-h-[190px] flex-col rounded-[8px] border border-newTableBorder bg-newBgColorInner p-[16px]"
            >
              <div className="flex items-start gap-[12px]">
                <img
                  className="h-[42px] w-[42px] rounded-[8px] object-cover"
                  src={`/icons/third-party/${integration.identifier}.png`}
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-[700]">
                    {integration.title}
                  </h3>
                  <div className="mt-[3px] text-[11px] font-[600] uppercase text-newTableText">
                    API key
                  </div>
                </div>
                {connected ? (
                  <FiCheckCircle
                    size={18}
                    className="text-emerald-600 dark:text-emerald-400"
                    aria-label="Connected"
                  />
                ) : null}
              </div>
              <p className="mt-[13px] flex-1 text-[13px] leading-[1.55] text-newTableText">
                {integration.description}
              </p>
              <Button
                onClick={
                  connected
                    ? undefined
                    : addApiKey(integration.title, integration.identifier)
                }
                disabled={connected}
                className="mt-[14px] w-full"
              >
                <span className="inline-flex items-center gap-[7px]">
                  {connected ? (
                    <FiCheckCircle size={15} aria-hidden="true" />
                  ) : (
                    <FiPlus size={15} aria-hidden="true" />
                  )}
                  {connected
                    ? t('connected', 'Connected')
                    : t('connect', 'Connect')}
                </span>
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
};
