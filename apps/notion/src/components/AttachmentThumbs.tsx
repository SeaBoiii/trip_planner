import React, { useEffect, useMemo, useState } from 'react';
import { getAttachmentFullBlob, getAttachmentThumbBlob, type ItemAttachmentRef } from '@trip-planner/core';
import { Image as ImageIcon, X } from 'lucide-react';

interface AttachmentThumbsProps {
  attachments?: ItemAttachmentRef[];
  maxCount?: number;
  size?: 'tiny' | 'small' | 'medium';
  interactive?: boolean;
  onSelect?: (attachment: ItemAttachmentRef) => void;
  onRemove?: (attachmentId: string) => void;
  emptyLabel?: string;
}

type UrlMap = Record<string, string>;

function sizeClass(size: NonNullable<AttachmentThumbsProps['size']>) {
  if (size === 'tiny') return 'h-10 w-10';
  if (size === 'small') return 'h-14 w-14';
  return 'h-20 w-20';
}

export function AttachmentThumbs({
  attachments,
  maxCount,
  size = 'small',
  interactive = false,
  onSelect,
  onRemove,
  emptyLabel,
}: AttachmentThumbsProps) {
  const visible = useMemo(() => (attachments ?? []).slice(0, maxCount ?? Number.MAX_SAFE_INTEGER), [attachments, maxCount]);
  const [thumbUrls, setThumbUrls] = useState<UrlMap>({});

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    async function loadThumbs() {
      const nextUrls: UrlMap = {};
      await Promise.all(
        visible.map(async (attachment) => {
          const blob = await getAttachmentThumbBlob(attachment.id);
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          nextUrls[attachment.id] = url;
        })
      );
      if (!cancelled) {
        setThumbUrls(nextUrls);
      }
    }

    if (visible.length > 0) {
      loadThumbs().catch(() => {
        if (!cancelled) setThumbUrls({});
      });
    } else {
      setThumbUrls({});
    }

    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [visible]);

  if (!visible.length) {
    return emptyLabel ? <p className="text-xs text-gray-500 dark:text-gray-400">{emptyLabel}</p> : null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((attachment) => (
        <div key={attachment.id} className={`relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${sizeClass(size)}`}>
          <button
            type="button"
            disabled={!interactive}
            onClick={() => onSelect?.(attachment)}
            className={`h-full w-full ${interactive ? 'cursor-pointer' : 'cursor-default'} bg-gray-100 dark:bg-gray-800`}
            title={attachment.caption || 'Attachment'}
          >
            {thumbUrls[attachment.id] ? (
              <img src={thumbUrls[attachment.id]} alt={attachment.caption || 'Attachment'} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-gray-400">
                <ImageIcon size={14} />
              </span>
            )}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-0.5 hover:bg-black/80"
              aria-label="Remove attachment"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}
      {attachments && maxCount && attachments.length > maxCount && (
        <div className={`${sizeClass(size)} rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400`}>
          +{attachments.length - maxCount}
        </div>
      )}
    </div>
  );
}

interface AttachmentLightboxProps {
  attachment?: ItemAttachmentRef | null;
  open: boolean;
  onClose: () => void;
}

export function AttachmentLightbox({ attachment, open, onClose }: AttachmentLightboxProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;
    if (!open || !attachment) {
      setUrl(null);
      return;
    }
    getAttachmentFullBlob(attachment.id)
      .then((blob) => {
        if (!blob || cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        revokedUrl = nextUrl;
        setUrl(nextUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [open, attachment?.id]);

  if (!open || !attachment) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-5xl max-h-full w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 rounded-full bg-black/70 text-white p-2 hover:bg-black/90"
          aria-label="Close image"
        >
          <X size={18} />
        </button>
        {url ? (
          <img src={url} alt={attachment.caption || 'Attachment'} className="max-h-full max-w-full object-contain rounded-lg" />
        ) : (
          <div className="text-sm text-white/80">Loading image...</div>
        )}
      </div>
    </div>
  );
}
