<#
.SYNOPSIS
  Compresses an ambient background video for Quranify using FFmpeg.
  Target: 720p (1280x720 max), H.264 (libx264), no audio track (-an), faststart (+faststart), ~3-8 MB.

.EXAMPLE
  .\scripts\compress-background.ps1 -InputFile "C:\videos\fireplace.mov" -OutputFile "C:\videos\fireplace-compressed.mp4"
#>
param(
  [Parameter(Mandatory=$true)]
  [string]$InputFile,

  [Parameter(Mandatory=$false)]
  [string]$OutputFile
)

if (-not (Test-Path $InputFile)) {
  Write-Error "Input file not found: $InputFile"
  exit 1
}

if (-not $OutputFile) {
  $dir = [System.IO.Path]::GetDirectoryName($InputFile)
  $base = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)
  $OutputFile = Join-Path $dir "$base-720p.mp4"
}

Write-Host "Compressing '$InputFile' to 720p H.264 with faststart..." -ForegroundColor Cyan

# FFmpeg settings:
# -vf "scale='min(1280,iw)':-2" : downscale to 720p max while preserving aspect ratio and ensuring even height
# -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p : universal mobile hardware decoding (iOS & Android)
# -crf 26 -preset slow : high visual fidelity at ~3-8 MB
# -an : strip audio (ambient sound is handled by web audio mixer)
# -movflags +faststart : enables instant playback on phones without waiting for full download
ffmpeg -y -i "$InputFile" `
  -vf "scale='min(1280,iw)':-2" `
  -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p `
  -crf 26 -preset slow `
  -an `
  -movflags +faststart `
  "$OutputFile"

if ($LASTEXITCODE -eq 0 -and (Test-Path $OutputFile)) {
  $inSize = (Get-Item $InputFile).Length / 1MB
  $outSize = (Get-Item $OutputFile).Length / 1MB
  Write-Host "Success! Compressed from $($inSize.ToString('F2')) MB to $($outSize.ToString('F2')) MB." -ForegroundColor Green
  Write-Host "Output: $OutputFile" -ForegroundColor Yellow
} else {
  Write-Error "FFmpeg compression failed."
}
