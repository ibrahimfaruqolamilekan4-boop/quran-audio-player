#!/usr/bin/env bash
# Compresses an ambient background video for Quranify using FFmpeg.
# Target: 720p (1280x720 max), H.264 (libx264), no audio track (-an), faststart (+faststart), ~3-8 MB.

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/compress-background.sh <input-video> [output-video]"
  exit 1
fi

INPUT="$1"
OUTPUT="${2:-${INPUT%.*}-720p.mp4}"

echo "Compressing '$INPUT' to 720p H.264 (no audio, faststart)..."

ffmpeg -y -i "$INPUT" \
  -vf "scale='min(1280,iw)':-2" \
  -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p \
  -crf 26 -preset slow \
  -an \
  -movflags +faststart \
  "$OUTPUT"

echo "Done! Output saved to '$OUTPUT'."
