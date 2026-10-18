// Types for media-lib.mjs. The module is plain ESM so the serverless bundle
// stays self-contained; this file is what `tsc --noEmit` reads.
import type { IncomingMessage, ServerResponse } from 'node:http';

export declare const MAX_INLINE_MEDIA_CHARS: number;
export declare const MAX_INLINE_IMAGE_CHARS: number;

export declare function readJsonLarge(req: IncomingMessage, limit?: number): Promise<any>;
export declare function cleanPortableImageUrl(value: unknown): string | null;
export declare function cleanPortableVideoUrl(value: unknown): string | null;
export declare function saveInlineMedia(
  dataUrl: string,
  kind: string,
  customId?: string
): Promise<{ id: string; mimeType: string }>;
export declare function saveMediaChunk(
  uploadId: string,
  chunkIndex: number,
  chunkData: string
): Promise<void>;
export declare function assembleMediaChunks(
  uploadId: string,
  mimeType: string,
  kind: string,
  customId?: string
): Promise<{ id: string; mimeType: string; size: number }>;
export declare function getInlineMedia(
  id: string
): Promise<{ mime_type: string; data_url: string } | null>;
export declare function streamBufferWithRange(
  req: IncomingMessage,
  res: ServerResponse,
  buffer: Buffer,
  mimeType: string
): void;

