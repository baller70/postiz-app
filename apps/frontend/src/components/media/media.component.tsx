'use client';

import React, {
  ChangeEvent,
  ClipboardEvent,
  FC,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@gitroom/react/form/button';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
import { Media } from '@prisma/client';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import EventEmitter from 'events';
import { useToaster } from '@gitroom/react/toaster/toaster';
import clsx from 'clsx';
import { VideoFrame } from '@gitroom/react/helpers/video.frame';
import { useUppyUploader } from '@gitroom/frontend/components/media/new.uploader';
import dynamic from 'next/dynamic';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { AiImage } from '@gitroom/frontend/components/launches/ai.image';
import { DropFiles } from '@gitroom/frontend/components/layout/drop.files';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ThirdPartyMedia } from '@gitroom/frontend/components/third-parties/third-party.media';
import { ReactSortable } from 'react-sortablejs';
import { MediaComponentInner } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { AiVideo } from '@gitroom/frontend/components/launches/ai.video';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ThirdPartyMediaLibrary } from '@gitroom/frontend/components/third-parties/third-party.media-library';
import { Dashboard } from '@uppy/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  DeleteCircleIcon,
  CloseCircleIcon,
  DragHandleIcon,
  MediaSettingsIcon,
  InsertMediaIcon,
  DesignMediaIcon,
  VerticalDividerIcon,
  NoMediaIcon,
  ExpandIcon,
  TagIcon,
  CloseIcon,
} from '@gitroom/frontend/components/ui/icons';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useShallow } from 'zustand/react/shallow';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useDebounce } from 'use-debounce';
import { ResilientMediaImage } from '@gitroom/frontend/components/media/resilient.media.image';
import {
  ALL_MEDIA,
  MediaBrandFolder,
  MediaBrandSource,
  UNFILED_MEDIA,
  deriveMediaBrandFolders,
  uploadBrandForFolder,
} from '@gitroom/frontend/components/media/media.brand.utils';
const Polonto = dynamic(
  () => import('@gitroom/frontend/components/launches/polonto')
);
const showModalEmitter = new EventEmitter();
export const Pagination: FC<{
  current: number;
  totalPages: number;
  setPage: (num: number) => void;
}> = (props) => {
  const t = useT();

  const { current, totalPages, setPage } = props;

  const paginationItems = useMemo(() => {
    // Convert to 1-based for algorithm (current is 0-based)
    const c = current + 1;
    const m = totalPages;

    // If total pages <= 10, show all pages
    if (m <= 10) {
      return Array.from({ length: m }, (_, i) => i + 1);
    }

    const delta = 3;
    const left = c - delta;
    const right = c + delta + 1;
    const range: number[] = [];
    const rangeWithDots: (number | '...')[] = [];
    let l: number | undefined;

    // Build the range of pages to show
    for (let i = 1; i <= m; i++) {
      if (i === 1 || i === m || (i >= left && i < right)) {
        range.push(i);
      }
    }

    // Add dots where there are gaps
    for (const i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    // Limit to maximum 10 items by trimming pages near edges if needed
    while (rangeWithDots.length > 10) {
      const currentIndex = rangeWithDots.findIndex((item) => item === c);
      if (currentIndex !== -1 && currentIndex > rangeWithDots.length / 2) {
        // Current is in second half, remove one item from start side
        rangeWithDots.splice(2, 1);
      } else {
        // Current is in first half, remove one item from end side
        rangeWithDots.splice(-3, 1);
      }
    }

    return rangeWithDots;
  }, [current, totalPages]);

  return (
    <ul className="flex flex-row items-center gap-1 justify-center mt-[15px]">
      <li className={clsx(current === 0 && 'opacity-20 pointer-events-none')}>
        <div
          className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 px-4 py-2 gap-1 ps-2.5 text-gray-400 hover:text-white border-[#1F1F1F] hover:bg-forth"
          aria-label="Go to previous page"
          onClick={() => setPage(current - 1)}
        >
          <ChevronLeftIcon className="lucide lucide-chevron-left h-4 w-4" />
          <span>{t('previous', 'Previous')}</span>
        </div>
      </li>
      {paginationItems.map((item, index) => (
        <li key={index}>
          {item === '...' ? (
            <span className="inline-flex items-center justify-center h-10 w-10 text-textColor select-none">
              ...
            </span>
          ) : (
            <div
              aria-current="page"
              onClick={() => setPage(item - 1)}
              className={clsx(
                'cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:bg-forth h-10 w-10 hover:text-white border-newBorder',
                current === item - 1
                  ? 'bg-forth !text-white'
                  : 'text-textColor hover:text-white'
              )}
            >
              {item}
            </div>
          )}
        </li>
      ))}
      <li
        className={clsx(
          current + 1 === totalPages && 'opacity-20 pointer-events-none'
        )}
      >
        <a
          className="text-textColor hover:text-white group cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 px-4 py-2 gap-1 pe-2.5 text-gray-400 border-[#1F1F1F] hover:bg-forth"
          aria-label="Go to next page"
          onClick={() => setPage(current + 1)}
        >
          <span>{t('next', 'Next')}</span>
          <ChevronRightIcon className="lucide lucide-chevron-right h-4 w-4" />
        </a>
      </li>
    </ul>
  );
};
export const ShowMediaBoxModal: FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [callBack, setCallBack] =
    useState<(params: { id: string; path: string }[]) => void | undefined>();
  const closeModal = useCallback(() => {
    setShowModal(false);
    setCallBack(undefined);
  }, []);
  useEffect(() => {
    showModalEmitter.on('show-modal', (cCallback) => {
      setShowModal(true);
      setCallBack(() => cCallback);
    });
    return () => {
      showModalEmitter.removeAllListeners('show-modal');
    };
  }, []);
  if (!showModal) return null;
  return (
    <div className="text-textColor">
      <MediaBox setMedia={callBack!} closeModal={closeModal} />
    </div>
  );
};
export const showMediaBox = (
  callback: (params: { id: string; path: string }) => void
) => {
  showModalEmitter.emit('show-modal', callback);
};
const CHUNK_SIZE = 1024 * 1024;
const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024; // 1 GB

type OrganizedMedia = Media & {
  brand?: string | null;
  tags?: string[];
};

type MediaResponse = {
  pages: number;
  results: OrganizedMedia[];
  summary?: {
    total: number;
    unfiled: number;
    brands: { name: string; count: number }[];
  };
};

const useMediaBrandSources = () => {
  const fetch = useFetch();
  const loadIntegrations = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not load integrations');
    }
    return ((await response.json()).integrations || []) as MediaBrandSource[];
  }, []);

  return useSWR('/integrations/list', loadIntegrations, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });
};

const FolderGlyph: FC<{ active?: boolean }> = ({ active }) => (
  <span className="relative block h-[34px] w-[42px] shrink-0" aria-hidden>
    <span
      className={clsx(
        'absolute start-[3px] top-0 h-[9px] w-[18px] rounded-t-[4px]',
        active ? 'bg-btnPrimary' : 'bg-newTextColor/30'
      )}
    />
    <span
      className={clsx(
        'absolute inset-x-0 bottom-0 h-[29px] rounded-[6px]',
        active ? 'bg-btnPrimary' : 'bg-newTextColor/20'
      )}
    />
  </span>
);

const MediaFolder: FC<{
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}> = ({ active, count, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={clsx(
      'flex h-[74px] min-w-[168px] max-w-[210px] items-center gap-[11px] rounded-[8px] border px-[13px] text-start transition-colors',
      active
        ? 'border-btnPrimary bg-btnPrimary/10 text-newTextColor'
        : 'border-newBorder bg-newBgColor hover:bg-boxHover'
    )}
  >
    <FolderGlyph active={active} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[12px] font-[600]">{label}</span>
      <span className="mt-[2px] block text-[10px] text-textItemBlur">
        {count} {count === 1 ? 'item' : 'items'}
      </span>
    </span>
  </button>
);

const MediaOrganizer: FC<{
  brands: MediaBrandFolder[];
  media: OrganizedMedia;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}> = ({ brands, media, onClose, onSaved }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const [brand, setBrand] = useState(media.brand || '');
  const [tags, setTags] = useState<string[]>(media.tags || []);
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const availableBrands = useMemo(() => {
    if (!media.brand || brands.some((item) => item.name === media.brand)) {
      return brands;
    }
    return [...brands, { id: media.brand, name: media.brand, count: 0 }];
  }, [brands, media.brand]);

  const addTags = useCallback((value: string) => {
    const nextTags = value
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    setTags((current) =>
      Array.from(new Set([...current, ...nextTags])).slice(0, 20)
    );
    setTagDraft('');
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const finalTags = Array.from(
        new Set([
          ...tags,
          ...tagDraft
            .split(',')
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        ])
      ).slice(0, 20);
      const response = await fetch(`/media/${media.id}/organize`, {
        method: 'PUT',
        body: JSON.stringify({ brand: brand || null, tags: finalTags }),
      });
      if (!response.ok) {
        throw new Error('Could not organize media');
      }
      await onSaved();
      toaster.show('Media organization saved', 'success');
      onClose();
    } catch {
      toaster.show('Could not save media organization', 'warning');
    } finally {
      setSaving(false);
    }
  }, [brand, media.id, onClose, onSaved, tagDraft, tags]);

  return (
    <div className="flex flex-col gap-[20px] py-[6px]">
      <label className="flex flex-col gap-[7px] text-[12px] font-[600]">
        Brand folder
        <select
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
          className="h-[44px] rounded-[7px] border border-newBorder bg-newBgColor px-[12px] text-[13px] font-[400] outline-none focus:border-btnPrimary"
        >
          <option value="">Unfiled</option>
          {availableBrands.map((folder) => (
            <option key={folder.id} value={folder.name}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-[7px]">
        <label
          htmlFor={`media-tags-${media.id}`}
          className="text-[12px] font-[600]"
        >
          Search tags
        </label>
        <div className="flex items-center gap-[7px] rounded-[7px] border border-newBorder bg-newBgColor px-[11px] focus-within:border-btnPrimary">
          <TagIcon className="h-[16px] w-[16px] shrink-0 text-textItemBlur" />
          <input
            id={`media-tags-${media.id}`}
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                addTags(tagDraft);
              }
            }}
            onBlur={() => addTags(tagDraft)}
            placeholder="Add a tag and press Enter"
            className="h-[42px] min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-[6px] pt-[3px]">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex h-[28px] items-center gap-[5px] rounded-[5px] bg-newBgColor px-[8px] text-[11px]"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    setTags((current) => current.filter((item) => item !== tag))
                  }
                  aria-label={`Remove ${tag}`}
                  className="text-textItemBlur hover:text-newTextColor"
                >
                  <CloseIcon className="h-[13px] w-[13px]" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-[8px] border-t border-newBorder pt-[16px]">
        <button
          type="button"
          onClick={onClose}
          className="h-[42px] rounded-[7px] border border-newBorder px-[15px] text-[12px] font-[600]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-[42px] rounded-[7px] bg-btnPrimary px-[17px] text-[12px] font-[600] text-white disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export const MediaBox: FC<{
  setMedia: (params: { id: string; path: string }[]) => void;
  standalone?: boolean;
  type?: 'image' | 'video';
  closeModal: () => void;
}> = ({ type, standalone, setMedia }) => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState(ALL_MEDIA);
  const [activeTag, setActiveTag] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  useEffect(() => {
    setPage(0);
  }, [activeFolder, activeTag, debouncedSearch]);
  const loadMedia = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page + 1) });
    if (debouncedSearch.trim()) {
      params.set('search', debouncedSearch.trim());
    }
    if (activeFolder !== ALL_MEDIA) {
      params.set('brand', activeFolder);
    }
    if (activeTag) {
      params.set('tag', activeTag);
    }
    return (await fetch(`/media?${params.toString()}`)).json();
  }, [activeFolder, activeTag, page, debouncedSearch]);
  const { data, mutate, isLoading } = useSWR<MediaResponse>(
    `get-media-${page}-${activeFolder}-${activeTag}-${debouncedSearch}`,
    loadMedia
  );
  const { data: brandSources = [] } = useMediaBrandSources();
  const brandFolders = useMemo(
    () => deriveMediaBrandFolders(brandSources, data?.summary?.brands || []),
    [brandSources, data?.summary?.brands]
  );
  const uploadBrand = uploadBrandForFolder(activeFolder);
  const [selected, setSelected] = useState([]);
  const t = useT();
  const uploaderRef = useRef<any>(null);
  const mediaDirectory = useMediaDirectory();
  const [loading, setLoading] = useState(false);

  const uppy = useUppyUploader({
    allowedFileTypes:
      type == 'image'
        ? 'image/*'
        : type == 'video'
        ? 'video/mp4'
        : 'image/*,video/mp4',
    onUploadSuccess: async (arr) => {
      await mutate();
      if (standalone) {
        return;
      }
      setSelected((prevSelected) => {
        return [...prevSelected, ...arr];
      });
    },
    onStart: () => setLoading(true),
    onEnd: () => setLoading(false),
  });

  const addRemoveSelected = useCallback(
    (media: any) => () => {
      if (standalone) {
        return;
      }
      const exists = selected.find((p: any) => p.id === media.id);
      if (exists) {
        setSelected(selected.filter((f: any) => f.id !== media.id));
        return;
      }
      setSelected([...selected, media]);
    },
    [selected]
  );

  const addMedia = useCallback(async () => {
    if (standalone) {
      return;
    }
    // @ts-ignore
    setMedia(selected);
    modals.closeCurrent();
  }, [selected]);

  const addToUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const totalSize = files.reduce((acc, file) => acc + file.size, 0);

      if (totalSize > MAX_UPLOAD_SIZE) {
        toaster.show(
          t(
            'upload_size_limit_exceeded',
            'Upload size limit exceeded. Maximum 1 GB per upload session.'
          ),
          'warning'
        );
        return;
      }

      setLoading(true);
      uppy.setMeta({ brand: uploadBrand });

      // @ts-ignore
      uppy.addFiles(files);
    },
    [toaster, t, uploadBrand, uppy]
  );

  const dragAndDrop = useCallback(
    async (event: ClipboardEvent<HTMLDivElement> | File[]) => {
      // @ts-ignore
      const clipboardItems = event.map((p) => ({
        kind: 'file',
        getAsFile: () => p,
      }));
      if (!clipboardItems) {
        return;
      }

      const files: File[] = [];
      // @ts-ignore
      for (const item of clipboardItems) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      const totalSize = files.reduce((acc, file) => acc + file.size, 0);

      if (totalSize > MAX_UPLOAD_SIZE) {
        toaster.show(
          t(
            'upload_size_limit_exceeded',
            'Upload size limit exceeded. Maximum 1 GB per upload session.'
          ),
          'warning'
        );
        return;
      }

      setLoading(true);
      uppy.setMeta({ brand: uploadBrand });

      for (const file of files) {
        uppy.addFile(file);
      }
    },
    [toaster, t, uploadBrand, uppy]
  );

  const maximize = useCallback(
    (media: OrganizedMedia) => async (e: any) => {
      e.stopPropagation();
      modals.openModal({
        title: '',
        top: 10,
        children: (
          <div className="w-full h-full p-[50px]">
            {hasExtension(media.path, 'mp4') ? (
              <VideoFrame
                autoplay={true}
                url={mediaDirectory.set(media.path)}
              />
            ) : (
              <ResilientMediaImage
                width="100%"
                height="100%"
                className="w-full h-full max-h-[100%] max-w-[100%] object-cover"
                src={mediaDirectory.set(media.path)}
                alt="media"
              />
            )}
          </div>
        ),
      });
    },
    []
  );

  const deleteImage = useCallback(
    (media: OrganizedMedia) => async (e: any) => {
      e.stopPropagation();
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_you_want_to_delete_the_image',
            'Are you sure you want to delete the image?'
          )
        ))
      ) {
        return;
      }
      await fetch(`/media/${media.id}`, {
        method: 'DELETE',
      });
      mutate();
    },
    [mutate]
  );

  const organizeMedia = useCallback(
    (media: OrganizedMedia) => (event: React.MouseEvent) => {
      event.stopPropagation();
      modals.openModal({
        title: t('organize_media', 'Organize media'),
        askClose: false,
        size: '520px',
        children: (close) => (
          <MediaOrganizer
            brands={brandFolders}
            media={media}
            onClose={close}
            onSaved={async () => {
              await mutate();
            }}
          />
        ),
      });
    },
    [brandFolders, modals, mutate, t]
  );

  const btn = useMemo(() => {
    return (
      <button
        disabled={loading}
        onClick={() => uploaderRef?.current?.click()}
        className="relative cursor-pointer bg-btnSimple changeColor flex gap-[8px] h-[44px] px-[18px] justify-center items-center rounded-[8px]"
      >
        {loading ? (
          <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%]">
            <div className="animate-spin h-[20px] w-[20px] border-4 border-white border-t-transparent rounded-full" />
          </div>
        ) : (
          <PlusIcon size={14} />
        )}
        <div className={loading ? 'invisible' : undefined}>
          {t('upload', 'Upload')}
        </div>
      </button>
    );
  }, [t, loading]);

  const activeFolderLabel =
    activeFolder === ALL_MEDIA
      ? t('all_media', 'All media')
      : activeFolder === UNFILED_MEDIA
      ? t('unfiled', 'Unfiled')
      : activeFolder;
  const uploadFolderLabel = uploadBrand || t('unfiled', 'Unfiled');
  const visibleMedia = useMemo(
    () =>
      (data?.results || []).filter((media) => {
        if (type === 'video') {
          return hasExtension(media.path, 'mp4');
        }
        if (type === 'image') {
          return !hasExtension(media.path, 'mp4');
        }
        return true;
      }),
    [data?.results, type]
  );

  return (
    <DropFiles
      disabled={loading}
      className="flex min-h-0 flex-1 flex-col"
      onDrop={dragAndDrop}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-[12px]">
        <div className="flex max-w-full gap-[8px] overflow-x-auto pb-[3px]">
          <MediaFolder
            active={activeFolder === ALL_MEDIA}
            count={data?.summary?.total || 0}
            label={t('all_media', 'All media')}
            onClick={() => setActiveFolder(ALL_MEDIA)}
          />
          <MediaFolder
            active={activeFolder === UNFILED_MEDIA}
            count={data?.summary?.unfiled || 0}
            label={t('unfiled', 'Unfiled')}
            onClick={() => setActiveFolder(UNFILED_MEDIA)}
          />
          {brandFolders.map((folder) => (
            <MediaFolder
              key={folder.id}
              active={activeFolder === folder.name}
              count={folder.count}
              label={folder.name}
              onClick={() => setActiveFolder(folder.name)}
            />
          ))}
        </div>

        <div className="flex flex-col gap-[9px] lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(
                'search_media_and_tags',
                'Search files or exact tags'
              )}
              className="h-[44px] w-full rounded-[8px] border border-newColColor bg-newBgColorInner px-[14px] text-[14px] outline-none focus:border-btnPrimary"
            />
          </div>
          <input
            type="file"
            ref={uploaderRef}
            onChange={addToUpload}
            className="hidden"
            multiple={true}
          />
          <div className="flex flex-wrap items-center gap-[8px]">
            <span className="max-w-[220px] truncate text-[11px] text-textItemBlur">
              {t('uploads_to', 'Uploads to')}: {uploadFolderLabel}
            </span>
            {btn}
            <ThirdPartyMediaLibrary onImported={() => mutate()} />
          </div>
        </div>

        {activeTag && (
          <div className="flex items-center gap-[7px]">
            <span className="flex h-[30px] items-center gap-[6px] rounded-[6px] bg-btnPrimary/10 px-[9px] text-[11px] text-newTextColor">
              <TagIcon className="h-[14px] w-[14px]" />
              {activeTag}
              <button
                type="button"
                onClick={() => setActiveTag('')}
                aria-label={t('clear_tag_filter', 'Clear tag filter')}
                className="text-textItemBlur hover:text-newTextColor"
              >
                <CloseIcon className="h-[13px] w-[13px]" />
              </button>
            </span>
          </div>
        )}

        <div className="w-full pointer-events-none relative mt-[5px] mb-[5px]">
          <div className="w-full h-[46px] overflow-hidden absolute left-0 bg-newBgColorInner uppyChange">
            <Dashboard
              height={46}
              uppy={uppy}
              id={`uploader`}
              showProgressDetails={true}
              hideUploadButton={true}
              hideRetryButton={true}
              hidePauseResumeButton={true}
              hideCancelButton={true}
              hideProgressAfterFinish={true}
            />
          </div>
          <div className="w-full h-[46px] uppyChange" />
        </div>
        <div className="relative min-h-[240px] flex-1 overflow-y-auto rounded-[8px] scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner">
          {isLoading && (
            <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {[...new Array(12)].map((_, index) => (
                <div
                  className="aspect-[4/5] animate-pulse rounded-[7px] bg-newSep"
                  key={index}
                />
              ))}
            </div>
          )}

          {!isLoading && visibleMedia.length === 0 && (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-[13px] rounded-[8px] bg-newTextColor/[0.02] px-[20px] text-center">
              <NoMediaIcon />
              <div className="text-[17px] font-[600]">
                {debouncedSearch || activeTag
                  ? t(
                      'no_media_match_filters',
                      'No media matches these filters'
                    )
                  : activeFolder === ALL_MEDIA
                  ? t('media_library_empty', 'Your media library is empty')
                  : `${t('no_media_in', 'No media in')} ${activeFolderLabel}`}
              </div>
            </div>
          )}

          {!isLoading && visibleMedia.length > 0 && (
            <div className="grid grid-cols-2 gap-[10px] pb-[4px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {visibleMedia.map((media) => {
                const selectionIndex = selected.findIndex(
                  (item: OrganizedMedia) => item.id === media.id
                );
                return (
                  <article
                    key={media.id}
                    onClick={addRemoveSelected(media)}
                    className={clsx(
                      'group min-w-0 overflow-hidden rounded-[8px] border bg-newBgColor transition-colors',
                      selectionIndex >= 0
                        ? 'border-btnPrimary'
                        : 'border-newBorder hover:border-newTextColor/30',
                      !standalone && 'cursor-pointer'
                    )}
                  >
                    <div className="relative aspect-square overflow-hidden bg-newBgColorInner">
                      {selectionIndex >= 0 && (
                        <span className="absolute end-[7px] top-[7px] z-[30] flex h-[25px] w-[25px] items-center justify-center rounded-full bg-btnPrimary text-[11px] font-[600] text-white">
                          {selectionIndex + 1}
                        </span>
                      )}
                      <div className="absolute start-[7px] top-[7px] z-[30] flex items-center gap-[5px] sm:hidden sm:group-hover:flex sm:group-focus-within:flex">
                        <button
                          type="button"
                          onClick={maximize(media)}
                          title={t('preview', 'Preview')}
                          className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] bg-black/75 text-white hover:bg-black"
                        >
                          <ExpandIcon className="h-[16px] w-[16px]" />
                        </button>
                        <button
                          type="button"
                          onClick={organizeMedia(media)}
                          title={t('organize_media', 'Organize media')}
                          className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] bg-black/75 text-white hover:bg-black"
                        >
                          <TagIcon className="h-[15px] w-[15px]" />
                        </button>
                        {selectionIndex < 0 && (
                          <button
                            type="button"
                            onClick={deleteImage(media)}
                            title={t('delete', 'Delete')}
                            className="flex h-[30px] w-[30px] items-center justify-center rounded-[6px] bg-black/75 text-white hover:bg-red-600"
                          >
                            <DeleteCircleIcon className="h-[18px] w-[18px]" />
                          </button>
                        )}
                      </div>
                      {hasExtension(media.path, 'mp4') ? (
                        <VideoFrame url={mediaDirectory.set(media.path)} />
                      ) : (
                        <ResilientMediaImage
                          width="100%"
                          height="100%"
                          className="h-full w-full object-cover"
                          src={mediaDirectory.set(media.path)}
                          alt={media.alt || media.originalName || 'Media'}
                        />
                      )}
                    </div>
                    <div className="flex min-h-[82px] flex-col gap-[7px] p-[9px]">
                      <span
                        className="truncate text-[11px] font-[600]"
                        title={media.originalName || media.name}
                      >
                        {media.originalName || media.name}
                      </span>
                      <span className="w-fit max-w-full truncate rounded-[4px] bg-newBgColorInner px-[6px] py-[3px] text-[9px] text-textItemBlur">
                        {media.brand || t('unfiled', 'Unfiled')}
                      </span>
                      {!!media.tags?.length && (
                        <div className="flex max-w-full gap-[4px] overflow-hidden">
                          {media.tags.slice(0, 2).map((tag) => (
                            <button
                              type="button"
                              key={tag}
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveTag(tag);
                              }}
                              className="max-w-[90px] truncate rounded-[4px] bg-btnPrimary/10 px-[5px] py-[2px] text-[9px] text-newTextColor"
                              title={tag}
                            >
                              {tag}
                            </button>
                          ))}
                          {media.tags.length > 2 && (
                            <span className="text-[9px] text-textItemBlur">
                              +{media.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
        {(data?.pages || 0) > 1 && (
          <Pagination
            current={page}
            totalPages={data?.pages}
            setPage={setPage}
          />
        )}
        {!standalone && (
          <div className="flex justify-end mt-[32px] gap-[8px]">
            <button
              onClick={() => modals.closeCurrent()}
              className="cursor-pointer h-[52px] px-[20px] items-center justify-center border border-newTextColor/10 flex rounded-[10px]"
            >
              {t('cancel', 'Cancel')}
            </button>
            {!isLoading && !!data?.results?.length && (
              <button
                onClick={standalone ? () => {} : addMedia}
                disabled={selected.length === 0}
                className="cursor-pointer text-white disabled:opacity-80 disabled:cursor-not-allowed h-[52px] px-[20px] items-center justify-center bg-[#612BD3] flex rounded-[10px]"
              >
                {t('add_selected_media', 'Add selected media')}
              </button>
            )}
          </div>
        )}
      </div>
    </DropFiles>
  );
};
export const MultiMediaComponent: FC<{
  label: string;
  description: string;
  mediaNotAvailable?: boolean;
  dummy: boolean;
  allData: {
    content: string;
    id?: string;
    image?: Array<{
      id: string;
      path: string;
    }>;
  }[];
  value?: Array<{
    path: string;
    id: string;
  }>;
  text: string;
  name: string;
  error?: any;
  onOpen?: () => void;
  onClose?: () => void;
  toolBar?: React.ReactNode;
  information?: React.ReactNode;
  onChange: (event: {
    target: {
      name: string;
      value?: Array<{
        id: string;
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }>;
    };
  }) => void;
}> = (props) => {
  const {
    name,
    error,
    text,
    onChange,
    value,
    allData,
    dummy,
    toolBar,
    information,
    mediaNotAvailable,
  } = props;
  const user = useUser();
  const modals = useModals();
  const t = useT();
  useEffect(() => {
    if (value) {
      setCurrentMedia(value);
    }
  }, [value]);

  const [currentMedia, setCurrentMedia] = useState(value);
  const mediaDirectory = useMediaDirectory();
  const changeMedia = useCallback(
    (
      m:
        | {
            path: string;
            id: string;
          }
        | {
            path: string;
            id: string;
          }[]
    ) => {
      const mediaArray = Array.isArray(m) ? m : [m];
      const newMedia = [...(currentMedia || []), ...mediaArray];
      setCurrentMedia(newMedia);
      onChange({
        target: {
          name,
          value: newMedia,
        },
      });
    },
    [currentMedia]
  );
  const showModal = useCallback(() => {
    modals.openModal({
      title: t('media_library', 'Media Library'),
      askClose: false,
      closeOnEscape: true,
      fullScreen: true,
      size: 'calc(100% - 80px)',
      height: 'calc(100% - 80px)',
      children: (close) => (
        <MediaBox setMedia={changeMedia} closeModal={close} />
      ),
    });
  }, [changeMedia, t]);

  const clearMedia = useCallback(
    (topIndex: number) => () => {
      const newMedia = currentMedia?.filter((f, index) => index !== topIndex);
      setCurrentMedia(newMedia);
      onChange({
        target: {
          name,
          value: newMedia,
        },
      });
    },
    [currentMedia]
  );

  const designMedia = useCallback(() => {
    if (!!user?.tier?.ai && !dummy) {
      modals.openModal({
        askClose: false,
        title: t('design_media', 'Design Media'),
        size: '80%',
        children: (close) => (
          <Polonto setMedia={changeMedia} closeModal={close} />
        ),
      });
    }
  }, [changeMedia, t]);

  return (
    <>
      <div className="b1 flex flex-col gap-[8px] rounded-bl-[8px] select-none w-full">
        <div className="flex gap-[10px] px-[12px]">
          {!!currentMedia && (
            <ReactSortable
              list={currentMedia}
              setList={(value) =>
                onChange({ target: { name: 'upload', value } })
              }
              className="flex gap-[10px] sortable-container"
              animation={200}
              swap={true}
              handle=".dragging"
            >
              {currentMedia.map((media, index) => (
                <div
                  key={media.id}
                  className="cursor-pointer rounded-[5px] w-[40px] h-[40px] border-2 border-tableBorder relative flex transition-all"
                >
                  <DragHandleIcon className="z-[20] dragging absolute pe-[1px] pb-[3px] -start-[4px] -top-[4px] cursor-move" />

                  <div className="w-full h-full relative group">
                    <div
                      onClick={async () => {
                        modals.openModal({
                          title: t('media_settings', 'Media Settings'),
                          children: (close) => (
                            <MediaComponentInner
                              media={media as any}
                              onClose={close}
                              onSelect={(value: any) => {
                                onChange({
                                  target: {
                                    name: 'upload',
                                    value: currentMedia.map((p) => {
                                      if (p.id === media.id) {
                                        return {
                                          ...p,
                                          ...value,
                                        };
                                      }
                                      return p;
                                    }),
                                  },
                                });
                              }}
                            />
                          ),
                        });
                      }}
                      className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] bg-black/80 rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-[9]"
                    >
                      <MediaSettingsIcon className="cursor-pointer relative z-[200]" />
                    </div>
                    {hasExtension(media?.path, 'mp4') ? (
                      <VideoFrame url={mediaDirectory.set(media?.path)} />
                    ) : (
                      <img
                        className="w-full h-full object-cover rounded-[4px]"
                        src={mediaDirectory.set(media?.path)}
                      />
                    )}
                  </div>

                  <CloseCircleIcon
                    onClick={clearMedia(index)}
                    className="absolute -end-[4px] -top-[4px] z-[20] rounded-full bg-white"
                  />
                </div>
              ))}
            </ReactSortable>
          )}
        </div>
        <div className="flex gap-[8px] px-[12px] border-t border-newColColor w-full b1 text-textColor">
          {!mediaNotAvailable && (
            <div className="flex py-[10px] b2 items-center gap-[4px]">
              <div
                onClick={showModal}
                className="cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]"
              >
                <div className="flex gap-[8px] items-center">
                  <div>
                    <InsertMediaIcon />
                  </div>
                  <div className="text-[10px] font-[600] maxMedia:hidden block">
                    {t('insert_media', 'Insert Media')}
                  </div>
                </div>
              </div>
              <div
                onClick={designMedia}
                className="cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]"
              >
                <div className="flex gap-[5px] items-center">
                  <div>
                    <DesignMediaIcon />
                  </div>
                  <div className="text-[10px] font-[600] iconBreak:hidden block">
                    {t('design_media', 'Design Media')}
                  </div>
                </div>
              </div>

              <ThirdPartyMedia allData={allData} onChange={changeMedia} />

              {!!user?.tier?.ai && (
                <>
                  <AiImage value={text} onChange={changeMedia} />
                  <AiVideo value={text} onChange={changeMedia} />
                </>
              )}
            </div>
          )}
          {!mediaNotAvailable && (
            <div className="text-newColColor h-full flex items-center">
              <VerticalDividerIcon />
            </div>
          )}
          {!!toolBar && (
            <div className="flex py-[10px] b2 items-center gap-[4px]">
              {toolBar}
            </div>
          )}
          {information && (
            <div className="flex-1 justify-end flex py-[10px] b2 items-center gap-[4px]">
              {information}
            </div>
          )}
        </div>
      </div>
      <div className="text-[12px] text-red-400">{error}</div>
    </>
  );
};
export const MediaComponent: FC<{
  label: string;
  description: string;
  value?: {
    path: string;
    id: string;
  };
  name: string;
  onChange: (event: {
    target: {
      name: string;
      value?: {
        id: string;
        path: string;
      };
    };
  }) => void;
  type?: 'image' | 'video';
  width?: number;
  height?: number;
}> = (props) => {
  const t = useT();

  const { name, type, label, description, onChange, value, width, height } =
    props;
  const { getValues } = useSettings();
  const user = useUser();
  useEffect(() => {
    const settings = getValues()[props.name];
    if (settings) {
      setCurrentMedia(settings);
    }
  }, []);
  const [currentMedia, setCurrentMedia] = useState(value);
  const modals = useModals();
  const mediaDirectory = useMediaDirectory();

  const showDesignModal = useCallback(() => {
    modals.openModal({
      title: t('media_editor', 'Media Editor'),
      askClose: false,
      closeOnEscape: true,
      fullScreen: true,
      size: 'calc(100% - 80px)',
      height: 'calc(100% - 80px)',
      children: (close) => (
        <Polonto
          width={width}
          height={height}
          setMedia={changeMedia}
          closeModal={close}
        />
      ),
    });
  }, [t]);
  const changeMedia = useCallback((m: { path: string; id: string }[]) => {
    setCurrentMedia(m[0]);
    onChange({
      target: {
        name,
        value: m[0],
      },
    });
  }, []);
  const showModal = useCallback(() => {
    modals.openModal({
      title: t('media_library', 'Media Library'),
      askClose: false,
      closeOnEscape: true,
      fullScreen: true,
      size: 'calc(100% - 80px)',
      height: 'calc(100% - 80px)',
      children: (close) => (
        <MediaBox setMedia={changeMedia} closeModal={close} type={type} />
      ),
    });
  }, [t]);
  const clearMedia = useCallback(() => {
    setCurrentMedia(undefined);
    onChange({
      target: {
        name,
        value: undefined,
      },
    });
  }, [value]);
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="text-[14px]">{label}</div>
      <div className="text-[12px]">{description}</div>
      {!!currentMedia && (
        <div className="my-[20px] cursor-pointer w-[200px] h-[200px] border-2 border-tableBorder">
          <img
            className="w-full h-full object-cover"
            src={currentMedia.path}
            onClick={() => window.open(mediaDirectory.set(currentMedia.path))}
          />
        </div>
      )}
      <div className="flex gap-[5px]">
        <Button onClick={showModal}>{t('select', 'Select')}</Button>
        <Button onClick={showDesignModal} className="!bg-customColor45">
          {t('editor', 'Editor')}
        </Button>
        <Button secondary={true} onClick={clearMedia}>
          {t('clear', 'Clear')}
        </Button>
      </div>
    </div>
  );
};
