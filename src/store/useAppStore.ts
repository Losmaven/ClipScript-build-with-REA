/**
 * Global application store using Zustand + Immer
 * Manages project state: media files, timeline clips, editor transcript,
 * playback state, and FFmpeg processing jobs.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaKind = 'video' | 'audio'

export interface MediaFile {
  id: string
  name: string
  kind: MediaKind
  objectUrl: string          // Revocable blob URL for playback
  duration: number           // Seconds
  sampleRate?: number
  width?: number
  height?: number
  thumbnail?: string         // Base64 data URL
  addedAt: number
}

export interface TimelineClip {
  id: string
  mediaId: string
  trackIndex: number
  startTime: number          // Seconds into the timeline
  endTime: number            // Seconds into the timeline
  mediaOffset: number        // Start of the clip within the source media
  label?: string
}

export interface TranscriptWord {
  id: string
  text: string
  startTime: number
  endTime: number
  confidence?: number
  deleted?: boolean          // Soft-deleted words drive cut edits
}

export interface TranscriptSegment {
  id: string
  speaker?: string
  words: TranscriptWord[]
}

export type ExportFormat = 'mp4' | 'webm' | 'mp3' | 'wav'

export interface ExportJob {
  id: string
  format: ExportFormat
  status: 'idle' | 'processing' | 'done' | 'error'
  progress: number           // 0–100
  outputUrl?: string
  error?: string
  startedAt?: number
}

export interface AppState {
  // Project meta
  projectId: string
  projectName: string

  // Media library
  mediaFiles: MediaFile[]

  // Timeline
  clips: TimelineClip[]
  trackCount: number

  // Playback
  currentTime: number        // Seconds
  duration: number           // Total timeline duration in seconds
  isPlaying: boolean
  playbackRate: number
  volume: number
  isMuted: boolean

  // Script/Transcript editor
  transcript: TranscriptSegment[]
  isTranscriptSynced: boolean // Whether transcript drives timeline

  // UI state
  selectedClipIds: string[]
  activePanel: 'script' | 'media' | 'export'
  timelineZoom: number       // Pixels per second

  // FFmpeg / export
  ffmpegReady: boolean
  ffmpegLoading: boolean
  exportJobs: ExportJob[]

  // Actions
  setProjectName: (name: string) => void
  addMediaFile: (file: MediaFile) => void
  removeMediaFile: (id: string) => void
  addClip: (clip: TimelineClip) => void
  removeClip: (id: string) => void
  updateClip: (id: string, patch: Partial<TimelineClip>) => void
  setCurrentTime: (t: number) => void
  setIsPlaying: (v: boolean) => void
  setPlaybackRate: (r: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setTranscript: (segments: TranscriptSegment[]) => void
  deleteTranscriptWord: (wordId: string) => void
  restoreTranscriptWord: (wordId: string) => void
  setIsTranscriptSynced: (v: boolean) => void
  selectClip: (id: string, multi?: boolean) => void
  clearSelection: () => void
  setActivePanel: (panel: AppState['activePanel']) => void
  setTimelineZoom: (zoom: number) => void
  setFfmpegReady: (v: boolean) => void
  setFfmpegLoading: (v: boolean) => void
  addExportJob: (job: ExportJob) => void
  updateExportJob: (id: string, patch: Partial<ExportJob>) => void
  removeExportJob: (id: string) => void
  recalcDuration: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
    // ── Initial State ──────────────────────────────────────────────────────
    projectId: crypto.randomUUID(),
    projectName: 'Untitled Project',

    mediaFiles: [],
    clips: [],
    trackCount: 2,

    currentTime: 0,
    duration: 0,
    isPlaying: false,
    playbackRate: 1,
    volume: 1,
    isMuted: false,

    transcript: [],
    isTranscriptSynced: false,

    selectedClipIds: [],
    activePanel: 'script',
    timelineZoom: 80, // 80px per second

    ffmpegReady: false,
    ffmpegLoading: false,
    exportJobs: [],

    // ── Actions ────────────────────────────────────────────────────────────

    setProjectName: (name) => set((s) => { s.projectName = name }),

    addMediaFile: (file) =>
      set((s) => {
        s.mediaFiles.push(file)
      }),

    removeMediaFile: (id) =>
      set((s) => {
        s.mediaFiles = s.mediaFiles.filter((f) => f.id !== id)
        s.clips = s.clips.filter((c) => c.mediaId !== id)
        get().recalcDuration()
      }),

    addClip: (clip) =>
      set((s) => {
        s.clips.push(clip)
        if (clip.endTime > s.duration) s.duration = clip.endTime
      }),

    removeClip: (id) =>
      set((s) => {
        s.clips = s.clips.filter((c) => c.id !== id)
        get().recalcDuration()
      }),

    updateClip: (id, patch) =>
      set((s) => {
        const clip = s.clips.find((c) => c.id === id)
        if (clip) Object.assign(clip, patch)
        get().recalcDuration()
      }),

    setCurrentTime: (t) => set((s) => { s.currentTime = t }),
    setIsPlaying: (v) => set((s) => { s.isPlaying = v }),
    setPlaybackRate: (r) => set((s) => { s.playbackRate = r }),
    setVolume: (v) => set((s) => { s.volume = v }),
    toggleMute: () => set((s) => { s.isMuted = !s.isMuted }),

    setTranscript: (segments) => set((s) => { s.transcript = segments }),

    deleteTranscriptWord: (wordId) =>
      set((s) => {
        for (const seg of s.transcript) {
          const word = seg.words.find((w) => w.id === wordId)
          if (word) { word.deleted = true; break }
        }
      }),

    restoreTranscriptWord: (wordId) =>
      set((s) => {
        for (const seg of s.transcript) {
          const word = seg.words.find((w) => w.id === wordId)
          if (word) { word.deleted = false; break }
        }
      }),

    setIsTranscriptSynced: (v) => set((s) => { s.isTranscriptSynced = v }),

    selectClip: (id, multi = false) =>
      set((s) => {
        if (multi) {
          const idx = s.selectedClipIds.indexOf(id)
          if (idx === -1) s.selectedClipIds.push(id)
          else s.selectedClipIds.splice(idx, 1)
        } else {
          s.selectedClipIds = [id]
        }
      }),

    clearSelection: () => set((s) => { s.selectedClipIds = [] }),

    setActivePanel: (panel) => set((s) => { s.activePanel = panel }),

    setTimelineZoom: (zoom) =>
      set((s) => { s.timelineZoom = Math.max(20, Math.min(zoom, 400)) }),

    setFfmpegReady: (v) => set((s) => { s.ffmpegReady = v }),
    setFfmpegLoading: (v) => set((s) => { s.ffmpegLoading = v }),

    addExportJob: (job) => set((s) => { s.exportJobs.push(job) }),

    updateExportJob: (id, patch) =>
      set((s) => {
        const job = s.exportJobs.find((j) => j.id === id)
        if (job) Object.assign(job, patch)
      }),

    removeExportJob: (id) =>
      set((s) => { s.exportJobs = s.exportJobs.filter((j) => j.id !== id) }),

    recalcDuration: () =>
      set((s) => {
        s.duration = s.clips.reduce((max, c) => Math.max(max, c.endTime), 0)
      }),
  })),
)
