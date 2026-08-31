'use client';

import clsx from 'clsx';
import React, {
  ImgHTMLAttributes,
  SyntheticEvent,
  useEffect,
  useState,
} from 'react';
import { MdBrokenImage } from '@meronex/icons/md';

type ResilientMediaImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  fallbackLabel?: string;
};

export const ResilientMediaImage = ({
  src,
  alt = 'media',
  className,
  fallbackLabel = 'Media unavailable',
  onError,
  ...props
}: ResilientMediaImageProps) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={fallbackLabel}
        data-media-state="unavailable"
        className={clsx(
          className,
          'flex flex-col items-center justify-center gap-[6px] bg-newBgColorInner text-newTextColor'
        )}
      >
        <MdBrokenImage aria-hidden size={32} />
        <span className="text-[12px] font-[500]">Unavailable</span>
      </div>
    );
  }

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      onError={(event: SyntheticEvent<HTMLImageElement>) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
};
