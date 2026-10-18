/**
 * App — root layout for the ClipScript editor.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────┐
 * │                   TopBar                        │
 * ├──────────────┬──────────────────┬───────────────┤
 * │ Left sidebar │  Center viewer   │ Right panel   │
 * │  (tabs:      │  (VideoPreview)  │  (Inspector   │
 * │   Script /   │                  │  / Properties)│
 * │   Media)     │                  │               │
 * ├──────────────┴──────────────────┴───────────────┤
 * │                   Timeline                      │
 * └─────────────────────────────────────────────────┘
 */

import React, { useCallback, useState } from 'react'
import { ExportDialog } from './components/ExportDialog/ExportDialog'
import { MediaPanel } from './components/MediaPanel/MediaPanel'
import { ScriptEditor } from './components/ScriptEditor/ScriptEditor'
import { Timeline } from './components/Timeline/Timeline'
import { TopBar } from './components/TopBar/TopBar'
import { VideoPreview } from './components/VideoPreview/VideoPreview'
import { useFFmpeg } from './hooks/useFFmpeg'
import { useAppStore } from './store/useAppStore'
import './App.css'

type SidebarTab = 'script' | 'media'

export default function App() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('script')
  const [exportOpen, setExportOpen] = useState(false)
  const ffmpegLoading = useAppStore((s) => s.ffmpegLoading)

  // Initialize FFmpeg on app load
  useFFmpeg()

  return (
    <div className="app">
      {/* ── Top bar ─────────────────────────────────── */}
      <TopBar onExport={() => setExportOpen(true)} />

      {/* ── Main workspace ──────────────────────────── */}
      <div className="app__workspace">
        {/* ── Left sidebar ──────────────────────────── */}
        <aside className="app__sidebar">
          <div className="app__sidebar-tabs">
            <button
              className={`app__tab ${sidebarTab === 'script' ? 'active' : ''}`}
              onClick={() => setSidebarTab('script')}
              id="tab-script"
            >
              Script
            </button>
            <button
              className={`app__tab ${sidebarTab === 'media' ? 'active' : ''}`}
              onClick={() => setSidebarTab('media')}
              id="tab-media"
            >
              Media
            </button>
          </div>

          <div className="app__sidebar-content">
            {sidebarTab === 'script' ? <ScriptEditor /> : <MediaPanel />}
          </div>
        </aside>

        {/* ── Center viewer ─────────────────────────── */}
        <main className="app__viewer">
          <VideoPreview />
        </main>

        {/* ── Right inspector (placeholder) ─────────── */}
        <aside className="app__inspector">
          <ClipInspector />
        </aside>
      </div>

      {/* ── Timeline ────────────────────────────────── */}
      <Timeline />

      {/* ── Export dialog ───────────────────────────── */}
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />

      {/* ── FFmpeg loading overlay ───────────────────── */}
      {ffmpegLoading && (
        <div className="app__ffmpeg-loading" role="status" aria-live="polite">
          <div className="app__ffmpeg-loading-inner">
            <div className="animate-spin" style={{ width: 20, height: 20, border: '2px solid var(--border-default)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
            <span>Loading FFmpeg.wasm…</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Clip Inspector (Right Panel) ──────────────────────────────────────────────

function ClipInspector() {
  const selectedClipIds = useAppStore((s) => s.selectedClipIds)
  const clips           = useAppStore((s) => s.clips)
  const mediaFiles      = useAppStore((s) => s.mediaFiles)
  const updateClip      = useAppStore((s) => s.updateClip)

  const selectedClip = clips.find((c) => c.id === selectedClipIds[0])
  const media = mediaFiles.find((f) => f.id === selectedClip?.mediaId)

  if (!selectedClip || !media) {
    return (
      <div className="inspector__empty">
        <p>Select a clip to inspect</p>
      </div>
    )
  }

  const duration = selectedClip.endTime - selectedClip.startTime

  return (
    <div className="inspector__content animate-fade-in">
      <h3 className="inspector__heading">Clip Properties</h3>

      <div className="inspector__field">
        <label className="inspector__label">Label</label>
        <input
          className="inspector__input"
          value={selectedClip.label ?? media.name}
          onChange={(e) => updateClip(selectedClip.id, { label: e.target.value })}
        />
      </div>

      <div className="inspector__field">
        <label className="inspector__label">Source</label>
        <span className="inspector__value truncate">{media.name}</span>
      </div>

      <div className="inspector__field">
        <label className="inspector__label">Start</label>
        <span className="inspector__value mono">{selectedClip.startTime.toFixed(3)}s</span>
      </div>

      <div className="inspector__field">
        <label className="inspector__label">End</label>
        <span className="inspector__value mono">{selectedClip.endTime.toFixed(3)}s</span>
      </div>

      <div className="inspector__field">
        <label className="inspector__label">Duration</label>
        <span className="inspector__value mono">{duration.toFixed(3)}s</span>
      </div>

      <div className="inspector__field">
        <label className="inspector__label">Track</label>
        <span className="inspector__value">{selectedClip.trackIndex === 0 ? 'Video' : 'Audio'} {selectedClip.trackIndex + 1}</span>
      </div>

      {media.thumbnail && (
        <div className="inspector__field">
          <label className="inspector__label">Thumbnail</label>
          <img
            src={media.thumbnail}
            alt="Clip thumbnail"
            className="inspector__thumbnail"
          />
        </div>
      )}
    </div>
  )
}
