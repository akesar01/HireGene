"use client";

import { useState } from "react";

/** Rendered size in CSS px (matches `w-7 h-7`). */
export const AVATAR_SIZE = 28;

interface AuthorAvatarProps {
  src?: string | null;
  name: string;
}

/**
 * Small author avatar for feed cards. LinkedIn photos arrive as signed
 * 400-800px URLs that cannot be resized (changing the size breaks the
 * signature), so the image is sized, lazy-loaded and decoded off the main
 * thread. Expired or blocked URLs fall back to the initial badge.
 */
export default function AuthorAvatar({ src, name }: AuthorAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-xs font-bold text-muted shrink-0">
        {name.charAt(0)}
      </div>
    );
  }

  return (
    // LinkedIn CDN avatars need native img + referrerPolicy.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={AVATAR_SIZE}
      height={AVATAR_SIZE}
      loading="lazy"
      decoding="async"
      className="w-7 h-7 rounded-full object-cover shrink-0"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      // An image that failed before hydration never fires onError.
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) setFailed(true);
      }}
    />
  );
}
