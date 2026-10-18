/**
 * TopBar — project name, undo/redo, playback controls, and export button.
 */

import {
  Download,
  Pause,
  Play,
  Redo2,
  Settings,
  SkipBack,
  SkipForward,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import React, { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import './TopBar.css'

interface TopBarProps {
  onExport?: () => void
}

export function TopBar({ onExport }: TopBarProps) {
  const projectName    = useAppStore((s) => s.projectName)
  const setProjectName = useAppStore((s) => s.setProjectName)
  const isPlaying      = useAppStore((s) => s.isPlaying)
  const setIsPlaying   = useAppStore((s) => s.setIsPlaying)
  const currentTime    = useAppStore((s) => s.currentTime)
  const duration       = useAppStore((s) => s.duration)
  const setCurrentTime = useAppStore((s) => s.setCurrentTime)
  const playbackRate   = useAppStore((s) => s.playbackRate)
  const setPlaybackRate = useAppStore((s) => s.setPlaybackRate)
  const isMuted        = useAppStore((s) => s.isMuted)
  const toggleMute     = useAppStore((s) => s.toggleMute)
  const volume         = useAppStore((s) => s.volume)
  const setVolume      = useAppStore((s) => s.setVolume)
  const ffmpegReady    = useAppStore((s) => s.ffmpegReady)
  const ffmpegLoading  = useAppStore((s) => s.ffmpegLoading)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(projectName)

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60).toString().padStart(2, '0')
    const s = Math.floor(t % 60).toString().padStart(2, '0')
    const ms = Math.floor((t % 1) * 10)
    return `${m}:${s}.${ms}`
  }

  const skipBack    = () => setCurrentTime(Math.max(0, currentTime - 5))
  const skipForward = () => setCurrentTime(Math.min(duration, currentTime + 5))

  const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
  const nextRate = () => {
    const idx = rates.indexOf(playbackRate)
    setPlaybackRate(rates[(idx + 1) % rates.length])
  }

  return (
    <header className="topbar">
      {/* ── Left: Logo + Project Name ─────────────────────── */}
      <div className="topbar__left">
        <div className="topbar__logo" aria-label="ClipScript">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="var(--brand-500)" />
            <path d="M6 7h6a5 5 0 0 1 0 10H6V7Z" fill="white" />
            <circle cx="16" cy="12" r="2" fill="white" opacity="0.6" />
          </svg>
        </div>

        {editingName ? (
          <input
            className="topbar__project-name-input"
            value={nameInput}
            autoFocus
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => {
              setProjectName(nameInput || 'Untitled Project')
              setEditingName(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                setProjectName(nameInput || 'Untitled Project')
                setEditingName(false)
              }
            }}
          />
        ) : (
          <button
            className="topbar__project-name"
            onClick={() => { setNameInput(projectName); setEditingName(true) }}
            title="Click to rename project"
          >
            {projectName}
          </button>
        )}

        <div className="topbar__divider" />

        <button className="topbar__icon-btn" title="Undo (⌘Z)">
          <Undo2 size={15} />
        </button>
        <button className="topbar__icon-btn" title="Redo (⌘⇧Z)">
          <Redo2 size={15} />
        </button>
      </div>

      {/* ── Center: Playback Controls ─────────────────────── */}
      <div className="topbar__center">
        <button className="topbar__icon-btn" onClick={skipBack} title="Skip back 5s">
          <SkipBack size={16} />
        </button>

        <button
          className="topbar__play-btn"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          id="playback-toggle"
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>

        <button className="topbar__icon-btn" onClick={skipForward} title="Skip forward 5s">
          <SkipForward size={16} />
        </button>

        <div className="topbar__timecode" title="Current time / Total duration">
          <span className="topbar__time-current">{formatTime(currentTime)}</span>
          <span className="topbar__time-sep">/</span>
          <span className="topbar__time-total">{formatTime(duration)}</span>
        </div>

        <button
          className="topbar__rate-btn"
          onClick={nextRate}
          title="Playback speed"
        >
          {playbackRate}×
        </button>

        {/* Volume */}
        <button className="topbar__icon-btn" onClick={toggleMute} title="Toggle mute">
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <input
          type="range"
          className="topbar__volume-slider"
          min={0} max={1} step={0.02}
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          title={`Volume: ${Math.round(volume * 100)}%`}
        />
      </div>

      {/* ── Right: FFmpeg Status + Export ─────────────────── */}
      <div className="topbar__right">
        {/* FFmpeg status pill */}
        <div
          className={`topbar__ffmpeg-pill ${ffmpegReady ? 'ready' : ffmpegLoading ? 'loading' : 'idle'}`}
          title={ffmpegReady ? 'FFmpeg ready' : ffmpegLoading ? 'Loading FFmpeg…' : 'FFmpeg not loaded'}
        >
          <span className="topbar__ffmpeg-dot" />
          <span className="topbar__ffmpeg-label">
            {ffmpegReady ? 'FFmpeg' : ffmpegLoading ? 'Loading…' : 'FFmpeg'}
          </span>
        </div>

        <button className="topbar__icon-btn" title="Settings">
          <Settings size={15} />
        </button>

        <button
          className="topbar__export-btn"
          onClick={onExport}
          disabled={!ffmpegReady}
          id="export-button"
          title={ffmpegReady ? 'Export project' : 'FFmpeg loading…'}
        >
          <Download size={14} />
          Export
        </button>
      </div>
    </header>
  )
}
