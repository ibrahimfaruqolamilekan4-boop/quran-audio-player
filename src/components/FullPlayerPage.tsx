import React, { useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { PlayerScreen } from './PlayerScreen';
import { Background } from '../types';

/**
 * Wrapper that pulls background data from PlayerContext and renders the full‑screen player.
 */
export const FullPlayerPage: React.FC = () => {
  const { customVideos, ambientVideoMapping } = usePlayer();

  // Convert CustomVideo entries to the Background shape expected by PlayerScreen.
  const backgrounds: Background[] = useMemo(() => {
    return customVideos.map((vid) => {
      const bg: Background = {
        id: vid.id,
        name: vid.name,
        videoUrl: vid.videoUrl ?? '',
        // ambientUrl is optional – look up by id in the ambient mapping if present.
        ambientUrl: ambientVideoMapping[vid.id] ?? undefined,
        // Use the video URL as thumbnail fallback; in a real app you would have a separate thumbnail.
        thumbnailUrl: vid.videoUrl,
        sizeBytes: vid.sizeBytes,
        createdAt: vid.createdAt,
      };
      return bg;
    });
  }, [customVideos, ambientVideoMapping]);

  return <PlayerScreen backgrounds={backgrounds} />;
};
