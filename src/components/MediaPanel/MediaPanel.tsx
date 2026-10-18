/**
 * MediaPanel — drag-and-drop media library sidebar.
 * Handles file imports, thumbnail generation, and FFmpeg-based audio extraction.
 */

import { Film, Music, Plus, Trash2, Upload } from 'lucide-react'
import React, { useCallback, useRef, useState } from 'react'
import { useFFmpeg } from '../../hooks/useFFmpeg'
import { useAppStore } from '../../store/useAppStore'
import type { MediaFile } from '../../store/useAppStore'
import './MediaPanel.css'

export function MediaPanel() {
  const mediaFiles = useAppStore((s) => s.mediaFiles)
  const addMediaFile = useAppStore((s) => s.addMediaFile)
  const removeMediaFile = useAppStore((s) => s.removeMediaFile)
  const addClip = useAppStore((s) => s.addClip)
  const clips   = useAppStore((s) => s.clips)

  const { isReady: ffmpegReady } = useFFmpeg()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // ── File ingestion ────────────────────────────────────────────────────────
  const ingestFile = useCallback(
    async (file: File) => {
      const kind = file.type.startsWith('video/') ? 'video' : 'audio'
      const objectUrl = URL.createObjectURL(file)
      const id = crypto.randomUUID()

      // Get duration from media element
      const duration = await getMediaDuration(objectUrl)

      // Generate thumbnail for video
      let thumbnail: string | undefined
      if (kind === 'video') {
        thumbnail = await generateVideoThumbnail(objectUrl)
      }

      const mediaFile: MediaFile = {
        id,
        name: file.name,
        kind,
        objectUrl,
        duration,
        thumbnail,
        addedAt: Date.now(),
      }

      addMediaFile(mediaFile)
    },
    [addMediaFile],
  )

  const handleFiles = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((f) => {
        if (f.type.startsWith('video/') || f.type.startsWith('audio/')) {
          ingestFile(f)
        }
      })
    },
    [ingestFile],
  )

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const onDragLeave = () => setIsDragOver(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  // ── Add to timeline ───────────────────────────────────────────────────────
  const addToTimeline = useCallback(
    (media: MediaFile) => {
      // Find the next available start time on the appropriate track
      const trackIndex = media.kind === 'video' ? 0 : 1
      const trackClips = clips.filter((c) => c.trackIndex === trackIndex)
      const startTime = trackClips.reduce((max, c) => Math.max(max, c.endTime), 0)

      addClip({
        id: crypto.randomUUID(),
        mediaId: media.id,
        trackIndex,
        startTime,
        endTime: startTime + media.duration,
        mediaOffset: 0,
        label: media.name.replace(/\.[^.]+$/, ''),
      })
    },
    [clips, addClip],
  )

  return (
    <div className="media-panel">
      <div className="media-panel__header">
        <h2 className="media-panel__title">Media Library</h2>
        <button
          className="media-panel__add-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Import media"
          id="import-media-btn"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Drop zone */}
      <div
        className={`media-panel__dropzone ${isDragOver ? 'active' : ''} ${mediaFiles.length > 0 ? 'compact' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => mediaFiles.length === 0 && fileInputRef.current?.click()}
      >
        <Upload size={mediaFiles.length > 0 ? 16 : 28} />
        <p>{mediaFiles.length > 0 ? 'Drop more files' : 'Drop video or audio files here'}</p>
        {mediaFiles.length === 0 && (
          <span className="media-panel__dropzone-hint">
            MP4, WebM, MOV, MP3, WAV, M4A supported
          </span>
        )}
      </div>

      {/* File list */}
      <div className="media-panel__list">
        {mediaFiles.map((file) => (
          <div key={file.id} className="media-item" id={`media-item-${file.id}`}>
            {/* Thumbnail / Icon */}
            <div className="media-item__thumb">
              {file.thumbnail ? (
                <img src={file.thumbnail} alt={file.name} className="media-item__thumb-img" />
              ) : (
                <div className="media-item__thumb-icon">
                  {file.kind === 'video' ? <Film size={18} /> : <Music size={18} />}
                </div>
              )}
              <div className={`media-item__kind-badge ${file.kind}`}>
                {file.kind === 'video' ? 'VID' : 'AUD'}
              </div>
            </div>

            {/* Info */}
            <div className="media-item__info">
              <span className="media-item__name" title={file.name}>{file.name}</span>
              <span className="media-item__meta">{formatDuration(file.duration)}</span>
            </div>

            {/* Actions */}
            <div className="media-item__actions">
              <button
                className="media-item__btn add"
                onClick={() => addToTimeline(file)}
                title="Add to timeline"
              >
                <Plus size={12} />
              </button>
              <button
                className="media-item__btn remove"
                onClick={() => removeMediaFile(file.id)}
                title="Remove from library"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        multiple
        className="sr-only"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        id="file-input-hidden"
      />
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getMediaDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.src = url
    el.preload = 'metadata'
    el.onloadedmetadata = () => resolve(el.duration)
    el.onerror = () => resolve(0)
  })
}

function generateVideoThumbnail(url: string): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    video.src = url
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.currentTime = 0.5

    video.onseeked = () => {
      canvas.width  = 120
      canvas.height = 68
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0, 120, 68)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    video.onerror = () => resolve('')
  })
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
