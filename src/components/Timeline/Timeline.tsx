/**
 * Timeline — multi-track clip editor with ruler, playhead, and waveform clips.
 * Supports drag-to-seek on the ruler, clip selection, and zoom in/out.
 */

import { ZoomIn, ZoomOut } from 'lucide-react'
import React, { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { TimelineClip } from '../../store/useAppStore'
import './Timeline.css'

const RULER_HEIGHT = 28
const TRACK_HEIGHT = 64
const LABEL_WIDTH  = 80

export function Timeline() {
  const clips          = useAppStore((s) => s.clips)
  const trackCount     = useAppStore((s) => s.trackCount)
  const currentTime    = useAppStore((s) => s.currentTime)
  const duration       = useAppStore((s) => s.duration)
  const zoom           = useAppStore((s) => s.timelineZoom)
  const setZoom        = useAppStore((s) => s.setTimelineZoom)
  const setCurrentTime = useAppStore((s) => s.setCurrentTime)
  const setIsPlaying   = useAppStore((s) => s.setIsPlaying)
  const selectedClipIds = useAppStore((s) => s.selectedClipIds)
  const selectClip     = useAppStore((s) => s.selectClip)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const mediaFiles     = useAppStore((s) => s.mediaFiles)

  const scrollRef = useRef<HTMLDivElement>(null)
  const rulerRef  = useRef<HTMLCanvasElement>(null)
  const isDragging = useRef(false)

  // Total pixels wide
  const totalWidth = Math.max(duration * zoom + 200, 1200)

  // ── Draw Ruler ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = rulerRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = RULER_HEIGHT * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    ctx.clearRect(0, 0, canvas.offsetWidth, RULER_HEIGHT)

    // Background
    ctx.fillStyle = 'var(--timeline-ruler)'
    // compute intervals
    const minPxPerLabel = 60
    const secPerLabel = Math.ceil(minPxPerLabel / zoom)
    const step = Math.max(1, secPerLabel)

    ctx.fillStyle = '#96a3b5'
    ctx.font = '10px JetBrains Mono, monospace'
    ctx.textBaseline = 'middle'

    const maxSec = Math.ceil(canvas.offsetWidth / zoom) + 1
    for (let s = 0; s <= maxSec; s += step) {
      const x = s * zoom
      const isMainTick = s % (step * 5) === 0

      ctx.strokeStyle = isMainTick ? '#6b7a93' : '#38465a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, isMainTick ? 4 : 12)
      ctx.lineTo(x, RULER_HEIGHT)
      ctx.stroke()

      if (isMainTick) {
        const label = formatTime(s)
        ctx.fillStyle = '#6b7a93'
        ctx.fillText(label, x + 3, RULER_HEIGHT / 2)
      }
    }
  }, [zoom, totalWidth])

  // ── Ruler click → seek ─────────────────────────────────────────────────────
  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      isDragging.current = true
      setIsPlaying(false)
      const rect = e.currentTarget.getBoundingClientRect()
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0
      const x = e.clientX - rect.left - LABEL_WIDTH + scrollLeft
      setCurrentTime(Math.max(0, x / zoom))

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        const x2 = ev.clientX - rect.left - LABEL_WIDTH + (scrollRef.current?.scrollLeft ?? 0)
        setCurrentTime(Math.max(0, x2 / zoom))
      }
      const onUp = () => {
        isDragging.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [zoom, setCurrentTime, setIsPlaying],
  )

  // ── Playhead X position ────────────────────────────────────────────────────
  const playheadX = LABEL_WIDTH + currentTime * zoom

  // ── Auto-scroll playhead into view ────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const px = currentTime * zoom
    const visible = el.scrollLeft + el.clientWidth - LABEL_WIDTH
    if (px > visible - 40 || px < el.scrollLeft) {
      el.scrollLeft = Math.max(0, px - el.clientWidth / 2)
    }
  }, [currentTime, zoom])

  const mediaName = (mediaId: string) =>
    mediaFiles.find((m) => m.id === mediaId)?.name ?? 'Clip'

  const clipColor = (mediaId: string) => {
    const f = mediaFiles.find((m) => m.id === mediaId)
    return f?.kind === 'audio' ? 'var(--timeline-clip-audio)' : 'var(--timeline-clip-video)'
  }

  return (
    <div className="timeline" id="timeline">
      {/* ── Top bar: track labels header + ruler ────────── */}
      <div className="timeline__header">
        <div className="timeline__track-label-spacer" style={{ width: LABEL_WIDTH }} />
        <div
          className="timeline__ruler-wrap"
          onMouseDown={handleRulerMouseDown}
          style={{ cursor: 'col-resize' }}
        >
          <canvas
            ref={rulerRef}
            className="timeline__ruler-canvas"
            style={{ height: RULER_HEIGHT, width: '100%' }}
          />
        </div>
      </div>

      {/* ── Scrollable track area ────────────────────────── */}
      <div className="timeline__scroll-area" ref={scrollRef}>
        {/* Playhead */}
        <div
          className="timeline__playhead"
          style={{ left: playheadX, height: trackCount * TRACK_HEIGHT }}
        />

        {/* Track rows */}
        {Array.from({ length: trackCount }, (_, trackIdx) => {
          const trackClips = clips.filter((c) => c.trackIndex === trackIdx)
          const isVideo = trackIdx === 0
          return (
            <div key={trackIdx} className="timeline__track-row">
              {/* Label */}
              <div
                className="timeline__track-label"
                style={{ width: LABEL_WIDTH }}
              >
                <span className={`timeline__track-type ${isVideo ? 'video' : 'audio'}`}>
                  {isVideo ? 'V' : 'A'}
                </span>
                <span className="timeline__track-name">Track {trackIdx + 1}</span>
              </div>

              {/* Clips */}
              <div
                className="timeline__track-clips"
                style={{ width: totalWidth }}
                onClick={() => clearSelection()}
              >
                {trackClips.map((clip) => (
                  <TimelineClipBlock
                    key={clip.id}
                    clip={clip}
                    zoom={zoom}
                    selected={selectedClipIds.includes(clip.id)}
                    color={clipColor(clip.mediaId)}
                    label={clip.label ?? mediaName(clip.mediaId)}
                    onSelect={(e) => {
                      e.stopPropagation()
                      selectClip(clip.id, e.shiftKey || e.metaKey)
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Zoom controls ───────────────────────────────── */}
      <div className="timeline__zoom-controls">
        <button
          className="timeline__zoom-btn"
          onClick={() => setZoom(zoom * 0.75)}
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <div className="timeline__zoom-label">{zoom}px/s</div>
        <button
          className="timeline__zoom-btn"
          onClick={() => setZoom(zoom * 1.33)}
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Clip Block ─────────────────────────────────────────────────────────────────

interface ClipBlockProps {
  clip: TimelineClip
  zoom: number
  selected: boolean
  color: string
  label: string
  onSelect: (e: React.MouseEvent) => void
}

function TimelineClipBlock({ clip, zoom, selected, color, label, onSelect }: ClipBlockProps) {
  const left  = clip.startTime * zoom
  const width = Math.max((clip.endTime - clip.startTime) * zoom, 4)

  return (
    <div
      className={`timeline__clip ${selected ? 'selected' : ''}`}
      style={{
        left,
        width,
        backgroundColor: color,
        '--clip-color': color,
      } as React.CSSProperties}
      onClick={onSelect}
      title={`${label} — ${formatDuration(clip.endTime - clip.startTime)}`}
    >
      <span className="timeline__clip-label">{label}</span>
      {/* Resize handles */}
      <div className="timeline__clip-handle left" />
      <div className="timeline__clip-handle right" />
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatDuration(s: number) {
  return `${s.toFixed(2)}s`
}
