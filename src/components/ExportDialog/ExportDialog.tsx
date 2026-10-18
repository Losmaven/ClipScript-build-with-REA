/**
 * ExportDialog — FFmpeg.wasm powered export modal.
 * Lets users choose format and quality, tracks progress, and downloads the result.
 */

import { Download, X } from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { useFFmpeg } from '../../hooks/useFFmpeg'
import { useAppStore } from '../../store/useAppStore'
import type { ExportFormat } from '../../store/useAppStore'
import './ExportDialog.css'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

const FORMAT_OPTIONS: Array<{ value: ExportFormat; label: string; desc: string; icon: string }> = [
  { value: 'mp4',  label: 'MP4 Video',  desc: 'H.264 + AAC — Best compatibility', icon: '🎬' },
  { value: 'webm', label: 'WebM Video', desc: 'VP9 + Opus — Smaller file size',  icon: '🌐' },
  { value: 'mp3',  label: 'MP3 Audio',  desc: 'Audio only — 320kbps',            icon: '🎵' },
  { value: 'wav',  label: 'WAV Audio',  desc: 'Lossless audio — Largest file',   icon: '🔊' },
]

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const mediaFiles   = useAppStore((s) => s.mediaFiles)
  const clips        = useAppStore((s) => s.clips)
  const transcript   = useAppStore((s) => s.transcript)
  const addExportJob = useAppStore((s) => s.addExportJob)
  const updateExportJob = useAppStore((s) => s.updateExportJob)
  const exportJobs   = useAppStore((s) => s.exportJobs)

  const { extractAudio, exportVideo, isReady } = useFFmpeg()

  const [format, setFormat] = useState<ExportFormat>('mp4')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Build cut list from deleted transcript words
  const getCuts = useCallback(() => {
    const allWords = transcript.flatMap((s) => s.words)
    const deleted = allWords.filter((w) => w.deleted)
    if (deleted.length === 0) return []

    // Merge contiguous deleted ranges into cut segments
    const cuts: Array<{ start: number; end: number }> = []
    let rangeStart = deleted[0].startTime
    let rangeEnd   = deleted[0].endTime

    for (let i = 1; i < deleted.length; i++) {
      const w = deleted[i]
      if (w.startTime - rangeEnd < 0.05) {
        rangeEnd = w.endTime
      } else {
        cuts.push({ start: rangeStart, end: rangeEnd })
        rangeStart = w.startTime
        rangeEnd   = w.endTime
      }
    }
    cuts.push({ start: rangeStart, end: rangeEnd })
    return cuts
  }, [transcript])

  const handleExport = useCallback(async () => {
    // Find the primary video/audio file
    const primaryClip = clips.find((c) => c.trackIndex === 0)
    const primaryMedia = mediaFiles.find((f) => f.id === primaryClip?.mediaId)
    if (!primaryMedia) {
      setError('No media on the timeline to export.')
      return
    }

    const jobId = crypto.randomUUID()
    const job = {
      id: jobId,
      format,
      status: 'processing' as const,
      progress: 0,
      startedAt: Date.now(),
    }
    addExportJob(job)
    setIsExporting(true)
    setExportProgress(0)
    setExportUrl(null)
    setError(null)

    try {
      // Fetch the actual File from the object URL
      const resp = await fetch(primaryMedia.objectUrl)
      const blob = await resp.blob()
      const file = new File([blob], primaryMedia.name, { type: blob.type })

      const onProgress = (p: number) => {
        setExportProgress(p)
        updateExportJob(jobId, { progress: p })
      }

      let result: { objectUrl: string }

      if (format === 'mp3' || format === 'wav') {
        result = await extractAudio(file, format as 'mp3' | 'wav', onProgress)
      } else {
        const cuts = getCuts()
        result = await exportVideo(file, format as 'mp4' | 'webm', cuts, onProgress)
      }

      setExportUrl(result.objectUrl)
      updateExportJob(jobId, { status: 'done', progress: 100, outputUrl: result.objectUrl })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      setError(msg)
      updateExportJob(jobId, { status: 'error', error: msg })
    } finally {
      setIsExporting(false)
    }
  }, [clips, mediaFiles, format, addExportJob, updateExportJob, extractAudio, exportVideo, getCuts])

  const handleDownload = useCallback(() => {
    if (!exportUrl) return
    const a = document.createElement('a')
    a.href = exportUrl
    a.download = `export.${format}`
    a.click()
  }, [exportUrl, format])

  if (!open) return null

  return (
    <div className="export-dialog-backdrop" onClick={onClose}>
      <div
        className="export-dialog animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        id="export-dialog"
      >
        {/* Header */}
        <div className="export-dialog__header">
          <h2 className="export-dialog__title" id="export-dialog-title">
            Export Project
          </h2>
          <button className="export-dialog__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Format selector */}
        <div className="export-dialog__body">
          {!isExporting && !exportUrl && (
            <>
              <p className="export-dialog__label">Choose export format</p>
              <div className="export-format-grid">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`export-format-card ${format === opt.value ? 'active' : ''}`}
                    onClick={() => setFormat(opt.value)}
                    id={`format-${opt.value}`}
                  >
                    <span className="export-format-card__icon">{opt.icon}</span>
                    <span className="export-format-card__label">{opt.label}</span>
                    <span className="export-format-card__desc">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {/* Cut info */}
              {transcript.length > 0 && (
                <div className="export-dialog__cut-info">
                  <span>
                    {transcript.flatMap((s) => s.words).filter((w) => w.deleted).length} words
                    will be cut based on your script edits
                  </span>
                </div>
              )}

              {error && <div className="export-dialog__error">{error}</div>}
            </>
          )}

          {/* Progress */}
          {isExporting && (
            <div className="export-progress">
              <div className="export-progress__label">
                Exporting as {format.toUpperCase()}…
              </div>
              <div className="export-progress__bar-track">
                <div
                  className="export-progress__bar-fill"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <div className="export-progress__pct">{exportProgress}%</div>
              <p className="export-progress__hint">
                FFmpeg is processing your media client-side — this may take a moment.
              </p>
            </div>
          )}

          {/* Done */}
          {exportUrl && !isExporting && (
            <div className="export-done animate-fade-in">
              <div className="export-done__icon">✅</div>
              <p className="export-done__label">Export complete!</p>
              <button className="export-done__download-btn" onClick={handleDownload} id="download-btn">
                <Download size={16} />
                Download {format.toUpperCase()}
              </button>
              <button
                className="export-done__again-btn"
                onClick={() => { setExportUrl(null); setExportProgress(0) }}
              >
                Export again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isExporting && !exportUrl && (
          <div className="export-dialog__footer">
            <button className="export-dialog__cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="export-dialog__export-btn"
              onClick={handleExport}
              disabled={!isReady}
              id="start-export-btn"
            >
              <Download size={14} />
              {isReady ? `Export as ${format.toUpperCase()}` : 'Loading FFmpeg…'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
