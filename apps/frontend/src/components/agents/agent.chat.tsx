'use client';

import React, {
  ChangeEvent,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import { CopilotChat, CopilotKitCSSProperties } from '@copilotkit/react-ui';
import {
  InputProps,
  UserMessageProps,
} from '@copilotkit/react-ui/dist/components/chat/props';
import { Input } from '@gitroom/frontend/components/agents/agent.input';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  CopilotKit,
  useCopilotAction,
  useCopilotMessagesContext,
} from '@copilotkit/react-core';
import { PropertiesContext } from '@gitroom/frontend/components/agents/agent';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { TextMessage } from '@copilotkit/runtime-client-gql';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { ExistingDataContextProvider } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
import { useUppyUploader } from '@gitroom/frontend/components/media/new.uploader';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { ResilientMediaImage } from '@gitroom/frontend/components/media/resilient.media.image';
import {
  CloseCircleIcon,
  InsertMediaIcon,
} from '@gitroom/frontend/components/ui/icons';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { formatPlatformName } from '@gitroom/frontend/components/agents/agent.composer.utils';
import type { AgentIntegration } from '@gitroom/frontend/components/agents/agent.composer.utils';

export const AgentChat: FC = () => {
  const { backendUrl } = useVariables();
  const params = useParams<{ id: string }>();
  const { properties } = useContext(PropertiesContext);
  const t = useT();

  return (
    <CopilotKit
      {...(params.id === 'new' ? {} : { threadId: params.id })}
      credentials="include"
      runtimeUrl={backendUrl + '/copilot/agent'}
      showDevConsole={false}
      agent="postiz"
      properties={{
        integrations: properties,
      }}
    >
      <Hooks />
      <LoadMessages id={params.id} />
      <div
        style={
          {
            '--copilot-kit-primary-color': 'var(--new-btn-primary)',
            '--copilot-kit-background-color': 'var(--new-bgColorInner)',
            '--copilot-kit-input-background-color': 'var(--new-bgColor)',
            '--copilot-kit-separator-color': 'var(--new-border)',
            '--copilot-kit-secondary-contrast-color':
              'rgb(var(--new-textColor))',
          } as CopilotKitCSSProperties
        }
        className="agent agent-composer flex min-h-0 min-w-0 flex-1 flex-col bg-newBgColorInner"
      >
        <CopilotChat
          className="h-full min-h-0 w-full"
          labels={{
            title: t('post_assistant', 'Post assistant'),
            initial: t(
              'agent_welcome_message_compact',
              'What are we publishing today?'
            ),
            placeholder: t(
              'agent_message_placeholder',
              'Write a post or ask the agent...'
            ),
          }}
          UserMessage={Message}
          Input={NewInput}
        />
      </div>
    </CopilotKit>
  );
};

const LoadMessages: FC<{ id: string }> = ({ id }) => {
  const { setMessages } = useCopilotMessagesContext();
  const fetch = useFetch();

  const loadMessages = useCallback(async (idToSet: string) => {
    const data = await (await fetch(`/copilot/${idToSet}/list`)).json();
    setMessages(
      data.messages.map((p: any) => {
        return new TextMessage({
          content: p.content.content,
          role: p.role,
        });
      })
    );
  }, []);

  useEffect(() => {
    if (id === 'new') {
      setMessages([]);
      return;
    }
    loadMessages(id);
  }, [id]);

  return null;
};

const Message: FC<UserMessageProps> = (props) => {
  const mediaDirectory = useMediaDirectory();
  const parsed = useMemo(() => {
    const content = props.message?.content || '';
    const mediaBlock = content.match(
      /\[--Media--\]([\s\S]*?)\[--Media--\]/
    )?.[1];
    const attachments = (mediaBlock || '')
      .split('\n')
      .map((line) => line.match(/^(Image|Video):\s+(.+)$/))
      .filter((match): match is RegExpMatchArray => !!match)
      .map((match) => ({ type: match[1], path: match[2].trim() }));
    const text = content
      .replace(/\[--Media--\][\s\S]*?\[--Media--\]/g, '')
      .replace(/\[--integrations--\][\s\S]*?\[--integrations--\]/g, '')
      .trim();

    return { text, attachments };
  }, [props.message?.content]);

  return (
    <div className="copilotKitMessage copilotKitUserMessage min-w-0 max-w-[min(80%,680px)]">
      {parsed.text && <p className="whitespace-pre-wrap">{parsed.text}</p>}
      {parsed.attachments.length > 0 && (
        <div className="mt-[10px] flex flex-wrap gap-[8px]">
          {parsed.attachments.map((attachment, index) => {
            const src = mediaDirectory.set(attachment.path);
            return attachment.type === 'Video' ? (
              <video
                key={`${attachment.path}-${index}`}
                controls
                preload="metadata"
                src={src}
                className="aspect-video h-[120px] max-w-full rounded-[6px] bg-black object-cover"
              />
            ) : (
              <ResilientMediaImage
                key={`${attachment.path}-${index}`}
                src={src}
                alt="Attached media"
                className="h-[120px] w-[120px] rounded-[6px] object-cover"
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

type ComposerMedia = {
  id: string;
  path: string;
  thumbnail?: string;
  originalName?: string;
};

const isVideoPath = (path: string) =>
  /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(path);

const isVideoMedia = (media: ComposerMedia) =>
  isVideoPath(media.path) || isVideoPath(media.originalName || '');

const previewMediaShape = (identifier: string) => {
  if (['instagram', 'instagramstandalone', 'tiktok'].includes(identifier)) {
    return 'aspect-[4/5] w-[82px]';
  }

  if (identifier === 'youtube') {
    return 'aspect-video w-[144px]';
  }

  return 'aspect-[4/3] w-[108px]';
};

const PlatformDraftPreview: FC<{
  integration: AgentIntegration;
  media: ComposerMedia[];
  text: string;
}> = ({ integration, media, text }) => {
  const mediaDirectory = useMediaDirectory();
  const firstMedia = media[0];
  const platform = formatPlatformName(integration.identifier);

  return (
    <article className="rounded-[7px] border border-newBorder bg-newBgColor px-[10px] py-[9px]">
      <header className="flex min-w-0 items-center gap-[7px]">
        <SafeImage
          src={`/icons/platforms/${integration.identifier}.png`}
          className="h-[18px] w-[18px] shrink-0 rounded-[4px]"
          alt=""
          width={18}
          height={18}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-[600]">
          {integration.name}
        </span>
        <span className="shrink-0 text-[10px] text-textItemBlur">
          {platform}
        </span>
      </header>

      <div className="mt-[8px] flex min-w-0 items-start gap-[10px]">
        <p className="max-h-[72px] min-w-0 flex-1 overflow-hidden whitespace-pre-wrap break-words text-[11px] leading-[18px] text-newTextColor">
          {text.trim() || (media.length ? 'Media post' : 'Start writing...')}
        </p>
        {firstMedia && (
          <div
            className={clsx(
              'relative shrink-0 overflow-hidden rounded-[6px] border border-newBorder bg-newBgColorInner',
              previewMediaShape(integration.identifier)
            )}
          >
            {isVideoMedia(firstMedia) ? (
              <video
                src={mediaDirectory.set(firstMedia.path)}
                muted
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              <ResilientMediaImage
                src={mediaDirectory.set(
                  firstMedia.thumbnail || firstMedia.path
                )}
                alt={firstMedia.originalName || 'Draft attachment'}
                className="h-full w-full object-cover"
              />
            )}
            {media.length > 1 && (
              <span className="absolute bottom-[4px] end-[4px] rounded-[4px] bg-black/75 px-[5px] py-[2px] text-[9px] font-[600] text-white">
                +{media.length - 1}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

const NewInput: FC<InputProps> = (props) => {
  const [media, setMedia] = useState<ComposerMedia[]>([]);
  const [value, setValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewIntegrationId, setPreviewIntegrationId] = useState('');
  const { properties } = useContext(PropertiesContext);
  const mediaDirectory = useMediaDirectory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const uppy = useUppyUploader({
    allowedFileTypes: 'image/*,video/*',
    onUploadSuccess: (uploads: any) => {
      const uploaded = (Array.isArray(uploads) ? uploads : []).filter(
        (item): item is ComposerMedia => !!item?.id && !!item?.path
      );
      setMedia((current) => {
        const currentIds = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...uploaded.filter((item) => !currentIds.has(item.id)),
        ];
      });
    },
    onStart: () => setUploading(true),
    onEnd: () => setUploading(false),
  });

  const addFiles = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      Array.from(event.target.files || []).forEach((file) => {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
        });
      });
      event.target.value = '';
    },
    [uppy]
  );

  const removeMedia = useCallback((id: string) => {
    setMedia((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    if (
      previewIntegrationId &&
      properties.some((integration) => integration.id === previewIntegrationId)
    ) {
      return;
    }

    setPreviewIntegrationId(properties[0]?.id || '');
  }, [previewIntegrationId, properties]);

  const previewIntegration = useMemo(
    () =>
      properties.find(
        (integration) => integration.id === previewIntegrationId
      ) || properties[0],
    [previewIntegrationId, properties]
  );

  return (
    <div className="agent-draft border-t border-newBorder bg-newBgColorInner">
      <section
        className="border-b border-newBorder px-[16px] py-[12px] sm:px-[24px]"
        aria-label={t('draft_preview', 'Draft preview')}
      >
        <div className="mx-auto flex w-full max-w-[920px] flex-col gap-[10px]">
          <div className="flex flex-wrap items-center justify-between gap-[8px]">
            <div>
              <h3 className="text-[13px] font-[600]">
                {t('attached_to_message', 'Attached to this message')}
              </h3>
              <p className="mt-[1px] text-[11px] text-textItemBlur">
                {properties.length}{' '}
                {properties.length === 1
                  ? t('publishing_channel', 'publishing channel')
                  : t('publishing_channels', 'publishing channels')}
                {' · '}
                {media.length}{' '}
                {media.length === 1
                  ? t('attachment', 'attachment')
                  : t('attachments', 'attachments')}
              </p>
            </div>
            <div className="flex max-w-full gap-[5px] overflow-x-auto pb-[2px]">
              {properties.map((integration) => (
                <button
                  type="button"
                  key={integration.id}
                  onClick={() => setPreviewIntegrationId(integration.id)}
                  className={clsx(
                    'flex h-[28px] max-w-[168px] shrink-0 items-center gap-[5px] rounded-[5px] border px-[7px] text-[10px] transition-colors',
                    previewIntegration?.id === integration.id
                      ? 'border-btnPrimary bg-btnPrimary/10 text-newTextColor'
                      : 'border-transparent bg-newBgColor text-textItemBlur hover:border-newBorder hover:text-newTextColor'
                  )}
                  title={`${integration.name} - ${formatPlatformName(
                    integration.identifier
                  )}`}
                >
                  <SafeImage
                    src={`/icons/platforms/${integration.identifier}.png`}
                    className="h-[14px] w-[14px] shrink-0 rounded-[3px]"
                    alt=""
                    width={14}
                    height={14}
                  />
                  <span className="truncate">
                    {formatPlatformName(integration.identifier)}
                  </span>
                </button>
              ))}
              {properties.length === 0 && (
                <span className="text-[11px] text-textItemBlur">
                  {t('no_targets_attached', 'No targets attached')}
                </span>
              )}
            </div>
          </div>

          {(value.trim() || media.length > 0) && previewIntegration && (
            <PlatformDraftPreview
              integration={previewIntegration}
              media={media}
              text={value}
            />
          )}

          {media.length > 0 && (
            <div className="flex max-w-full gap-[6px] overflow-x-auto pb-[2px]">
              {media.map((item) => {
                const src = mediaDirectory.set(item.thumbnail || item.path);
                return (
                  <div
                    key={item.id}
                    className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[6px] border border-newBorder bg-newBgColor"
                  >
                    {isVideoMedia(item) ? (
                      <video
                        src={mediaDirectory.set(item.path)}
                        muted
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ResilientMediaImage
                        src={src}
                        alt={item.originalName || 'Draft attachment'}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(item.id)}
                      className="absolute end-[2px] top-[2px] flex h-[20px] w-[20px] items-center justify-center rounded-full bg-black/80 text-white"
                      aria-label={t('remove_attachment', 'Remove attachment')}
                    >
                      <CloseCircleIcon className="h-[16px] w-[16px]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[920px] items-center gap-[8px] px-[16px] pt-[10px] sm:px-[24px]">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime"
          multiple
          onChange={addFiles}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-[34px] items-center gap-[7px] rounded-[6px] bg-newBgColor px-[10px] text-[11px] font-[600] text-newTextColor hover:bg-boxHover disabled:cursor-wait disabled:opacity-60"
        >
          <InsertMediaIcon className="h-[16px] w-[16px]" />
          {uploading
            ? t('uploading', 'Uploading...')
            : t('add_media', 'Add image or video')}
        </button>
        {media.length > 0 && (
          <span className="text-[11px] text-textItemBlur">
            {media.length}{' '}
            {media.length === 1
              ? t('file_ready', 'file ready')
              : t('files_ready', 'files ready')}
          </span>
        )}
      </div>

      <Input
        {...props}
        canSendEmpty={media.length > 0 && !uploading}
        isSendBlocked={uploading}
        onChange={setValue}
        onSend={(text) => {
          const send = props.onSend(
            text +
              (media.length > 0
                ? '\n[--Media--]' +
                  media
                    .map((m) =>
                      isVideoMedia(m) || hasExtension(m.path, 'mp4')
                        ? `Video: ${m.path}`
                        : `Image: ${m.path}`
                    )
                    .join('\n') +
                  '\n[--Media--]'
                : '') +
              `
${
  properties.length
    ? `[--integrations--]
Use the following social media platforms: ${JSON.stringify(
        properties.map((p) => ({
          id: p.id,
          platform: p.identifier,
          profilePicture: p.picture,
          additionalSettings: p.additionalSettings,
        }))
      )}
[--integrations--]`
    : ``
}`
          );
          setValue('');
          setMedia([]);
          return send;
        }}
      />
    </div>
  );
};

export const Hooks: FC = () => {
  const modals = useModals();

  useCopilotAction({
    name: 'manualPosting',
    description:
      'This tool should be triggered when the user wants to manually add the generated post',
    parameters: [
      {
        name: 'list',
        type: 'object[]',
        description:
          'list of posts to schedule to different social media (integration ids)',
        attributes: [
          {
            name: 'integrationId',
            type: 'string',
            description: 'The integration id',
          },
          {
            name: 'date',
            type: 'string',
            description: 'UTC date of the scheduled post',
          },
          {
            name: 'settings',
            type: 'object',
            description: 'Settings for the integration [input:settings]',
          },
          {
            name: 'posts',
            type: 'object[]',
            description: 'list of posts / comments (one under another)',
            attributes: [
              {
                name: 'content',
                type: 'string',
                description: 'the content of the post',
              },
              {
                name: 'attachments',
                type: 'object[]',
                description: 'list of attachments',
                attributes: [
                  {
                    name: 'id',
                    type: 'string',
                    description: 'id of the attachment',
                  },
                  {
                    name: 'path',
                    type: 'string',
                    description: 'url of the attachment',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    renderAndWaitForResponse: ({ args, status, respond }) => {
      if (status === 'executing') {
        return <OpenModal args={args} respond={respond} />;
      }

      return null;
    },
  });
  return null;
};

const OpenModal: FC<{
  respond: (value: any) => void;
  args: {
    list: {
      integrationId: string;
      date: string;
      settings?: Record<string, any>;
      posts: { content: string; attachments: { id: string; path: string }[] }[];
    }[];
  };
}> = ({ args, respond }) => {
  const modals = useModals();
  const { properties } = useContext(PropertiesContext);
  const startModal = useCallback(async () => {
    for (const integration of args.list) {
      await new Promise((res) => {
        const group = makeId(10);
        modals.openModal({
          id: 'add-edit-modal',
          closeOnClickOutside: false,
          removeLayout: true,
          closeOnEscape: false,
          withCloseButton: false,
          askClose: true,
          size: '80%',
          title: ``,
          classNames: {
            modal: 'w-[100%] max-w-[1400px] text-textColor',
          },
          children: (
            <ExistingDataContextProvider
              value={{
                group,
                integration: integration.integrationId,
                integrationPicture:
                  properties.find((p) => p.id === integration.integrationId)
                    .picture || '',
                settings: integration.settings || {},
                posts: integration.posts.map((p) => ({
                  approvedSubmitForOrder: 'NO',
                  content: p.content,
                  createdAt: new Date().toISOString(),
                  state: 'DRAFT',
                  id: makeId(10),
                  settings: JSON.stringify(integration.settings || {}),
                  group,
                  integrationId: integration.integrationId,
                  integration: properties.find(
                    (p) => p.id === integration.integrationId
                  ),
                  publishDate: dayjs.utc(integration.date).toISOString(),
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                })),
              }}
            >
              <AddEditModal
                date={dayjs.utc(integration.date)}
                allIntegrations={properties}
                integrations={properties.filter(
                  (p) => p.id === integration.integrationId
                )}
                onlyValues={integration.posts.map((p) => ({
                  content: p.content,
                  id: makeId(10),
                  settings: integration.settings || {},
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                }))}
                reopenModal={() => {}}
                mutate={() => res(true)}
              />
            </ExistingDataContextProvider>
          ),
        });
      });
    }

    respond('User scheduled all the posts');
  }, [args, respond, properties]);

  useEffect(() => {
    startModal();
  }, []);
  return (
    <div onClick={() => respond('continue')}>
      Opening manually ${JSON.stringify(args)}
    </div>
  );
};
