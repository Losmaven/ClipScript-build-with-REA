/**
 * VideoPreview — central viewer for the currently playing media.
 * Shows video element or waveform for audio-only files.
 */

import { Maximize2, Volume2, VolumeX } from 'lucide-react'
import React, { useCallback, useEffect, useRef } from 'react'
import { useMediaPlayer } from '../../hooks/useMediaPlayer'
import { useAppStore } from '../../store/useAppStore'
import './VideoPreview.css'

export function VideoPreview() {
  const mediaFiles   = useAppStore((s) => s.mediaFiles)
  const clips        = useAppStore((s) => s.clips)
  const currentTime  = useAppStore((s) => s.currentTime)
  const volume       = useAppStore((s) => s.volume)
  const isMuted      = useAppStore((s) => s.isMuted)
  const toggleMute   = useAppStore((s) => s.toggleMute)
  const setVolume    = useAppStore((s) => s.setVolume)

  // Determine which clip is active at currentTime (first video clip wins)
  const activeClip = clips.find(
    (c) => c.trackIndex === 0 && currentTime >= c.startTime && currentTime <= c.endTime,
  )
  const activeMedia = mediaFiles.find((f) => f.id === activeClip?.mediaId)
  const mediaUrl = activeMedia?.objectUrl

  const { attachElement } = useMediaPlayer(mediaUrl)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const setRef = useCallback(
    (el: HTMLVideoElement | null) => {
      ;(videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
      attachElement(el)
    },
    [attachElement],
  )

  // Fullscreen support
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }, [])

  return (
    <div className="video-preview" ref={containerRef}>
      {mediaUrl && activeMedia?.kind === 'video' ? (
        <>
          <video
            ref={setRef}
            src={mediaUrl}
            className="video-preview__video"
            playsInline
            preload="auto"
          />
          {/* Overlay controls */}
          <div className="video-preview__overlay">
            <div className="video-preview__overlay-controls">
              <button
                className="video-preview__ctrl-btn"
                onClick={toggleMute}
                title="Toggle mute"
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input
                type="range"
                min={0} max={1} step={0.02}
                value={isMuted ? 0 : volume}
                className="video-preview__vol-slider"
                onChange={(e) => setVolume(Number(e.target.value))}
              />
              <button
                className="video-preview__ctrl-btn"
                onClick={toggleFullscreen}
                title="Fullscreen"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="video-preview__empty">
          {clips.length === 0 ? (
            <>
              <div className="video-preview__empty-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="12" fill="rgba(37,99,235,0.1)" />
                  <path d="M16 14h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2Z" stroke="rgba(37,99,235,0.6)" strokeWidth="1.5" />
                  <path d="M21 19l8 5-8 5V19Z" fill="rgba(37,99,235,0.6)" />
                </svg>
              </div>
              <p className="video-preview__empty-text">No media on timeline</p>
              <span className="video-preview__empty-hint">
                Import a file from the Media Library and add it to the timeline
              </span>
            </>
          ) : (
            <p className="video-preview__empty-text">
              {activeMedia?.kind === 'audio' ? '🎵 Audio playing' : 'Seek to a clip to preview'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
