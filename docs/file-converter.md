# File Converter (Retired)

This document describes how the retired file converter worked before it was removed for stability and security.

## Overview

The converter accepted file uploads from the frontend, stored them in temporary directories, converted them on the backend, and returned the converted file as a download. A separate video downloader/converter handled URL-based media conversions with queueing and rate limits.

## Backend Flow (File Conversion)

- Endpoint: `POST /api/v1/convert/upload`
- Input: multipart form-data with `file` and `target_format`
- Output: a binary download (`application/octet-stream`) with the converted file

Steps:

1. Validate file size.
2. Sanitize the filename to avoid path traversal.
3. Save the upload to a temp directory:
   - Base: `/tmp/project-one` (or `PROJECT_TMP_DIR` override)
   - Uploads: `temp_uploads/`
   - Converted outputs: `temp_converted/`
4. Convert based on input/output types:
   - Images: Pillow
   - Audio/video: FFmpeg
   - PDFs: ReportLab (image/text) with a fallback plain-text report
   - Text: best-effort extraction for text-based inputs
   - ZIP: archive the original file
5. Return the converted file and schedule deletion after the response.
6. Periodic cleanup thread removed stale files.

## Supported Conversions (File Conversion)

- Image: JPG, PNG, WEBP, BMP, GIF, TIFF
- Audio: MP3, WAV, OGG, FLAC, AAC, M4A
- Video: MP4, AVI, MOV, MKV, WMV, WEBM (video -> audio)
- Documents/Text: PDF, TXT
- Archive: ZIP

## Backend Flow (Video Conversion)

- Endpoint group:
  - `POST /api/v1/video/validate`
  - `POST /api/v1/video/convert`
  - `GET /api/v1/video/download/{download_id}`
- Internals:
  - Queued conversions with per-IP rate limits
  - Process pools for short/long conversions
  - URL detection for supported platforms
  - Fallback via Invidious instances when direct extraction failed
  - Metadata embedding for audio/video where supported

The video pipeline used FFmpeg for post-processing and `yt-dlp` for extraction. Downloaded and generated files were stored under:

- `temp_video_downloads/`

A watchdog and cleanup thread pruned stale artifacts.

## Frontend Flow

- Page: `/pages/conversion/`
- Script: `/js/pages/conversion/conversion.js`
- Styling: `/css/pages/conversion/conversion.css`

The frontend:

1. Let users drag-and-drop or select files.
2. Allowed format selection by category (documents, images, audio, video).
3. Uploaded files to `/api/v1/convert/upload` and streamed progress updates.
4. Rendered a download list for converted files.

## Operational Safeguards (Historic)

- Temporary storage in non-repo directories
- Scheduled cleanup of old files
- Filename sanitization
- Size limits to reduce abuse
- Per-IP throttling for video conversions

## Current Status

All converter endpoints, frontend pages, and related assets have been removed. This document remains as historical reference only.
