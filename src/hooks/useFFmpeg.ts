/**
 * useFFmpeg — singleton hook for loading and using FFmpeg.wasm
 *
 * FFmpeg.wasm requires SharedArrayBuffer, which in turn needs COOP+COEP
 * headers (set in vite.config.ts for dev, and your deployment server for prod).
 *
 * Usage:
 *   const { ffmpeg, transcode, isReady, isLoading, progress } = useFFmpeg()
 */

import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

// FFmpeg is imported dynamically to avoid SSR issues and allow lazy loading
let ffmpegSingleton: InstanceType<typeof import('@ffmpeg/ffmpeg').FFmpeg> | null = null

export interface TranscodeOptions {
  inputName: string        // e.g. "input.mp4"
  outputName: string       // e.g. "output.mp3"
  args: string[]           // FFmpeg CLI args between -i and output
  inputData: Uint8Array | File | Blob
  onProgress?: (ratio: number) => void
}

export interface TranscodeResult {
  data: Uint8Array
  objectUrl: string
}

export function useFFmpeg() {
  const setFfmpegReady = useAppStore((s) => s.setFfmpegReady)
  const setFfmpegLoading = useAppStore((s) => s.setFfmpegLoading)
  const isReady = useAppStore((s) => s.ffmpegReady)
  const isLoading = useAppStore((s) => s.ffmpegLoading)

  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const ffmpegRef = useRef<typeof ffmpegSingleton>(null)
  const initializedRef = useRef(false)

  const load = useCallback(async () => {
    if (initializedRef.current || ffmpegSingleton) {
      ffmpegRef.current = ffmpegSingleton
      setFfmpegReady(true)
      return
    }

    try {
      setFfmpegLoading(true)
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const ff = new FFmpeg()

      // Wire up logging and progress
      ff.on('log', ({ message }) => {
        setLogs((prev) => [...prev.slice(-199), message])
      })

      ff.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100))
      })

      // Use CDN-hosted WASM for correct MIME type; in production, host these yourself
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      await ff.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      ffmpegSingleton = ff
      ffmpegRef.current = ff
      initializedRef.current = true
      setFfmpegReady(true)
    } catch (err) {
      console.error('[FFmpeg] Failed to load:', err)
    } finally {
      setFfmpegLoading(false)
    }
  }, [setFfmpegReady, setFfmpegLoading])

  // Auto-load on first mount
  useEffect(() => {
    if (!isReady && !isLoading) {
      load()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * transcode — write input file to WASM FS, run FFmpeg args, return output
   */
  const transcode = useCallback(
    async (opts: TranscodeOptions): Promise<TranscodeResult> => {
      const ff = ffmpegRef.current
      if (!ff) throw new Error('FFmpeg not loaded')

      const { inputName, outputName, args, inputData, onProgress } = opts

      // Progress bridge
      const progressHandler = ({ progress: p }: { progress: number }) => {
        const pct = Math.round(p * 100)
        setProgress(pct)
        onProgress?.(pct)
      }
      ff.on('progress', progressHandler)

      try {
        // Write input to virtual FS
        await ff.writeFile(inputName, await fetchFile(inputData))

        // Execute
        await ff.exec(['-i', inputName, ...args, outputName])

        // Read output
        const data = await ff.readFile(outputName) as Uint8Array
        const blob = new Blob([data], { type: getMimeType(outputName) })
        const objectUrl = URL.createObjectURL(blob)

        // Clean up virtual FS
        await ff.deleteFile(inputName).catch(() => {})
        await ff.deleteFile(outputName).catch(() => {})

        return { data, objectUrl }
      } finally {
        ff.off('progress', progressHandler)
      }
    },
    [],
  )

  /**
   * extractAudio — convenience wrapper to strip audio from a video file
   */
  const extractAudio = useCallback(
    async (file: File, format: 'mp3' | 'wav' = 'mp3', onProgress?: (p: number) => void) => {
      const args =
        format === 'mp3'
          ? ['-vn', '-acodec', 'libmp3lame', '-q:a', '2']
          : ['-vn', '-acodec', 'pcm_s16le']

      return transcode({
        inputName: `input_${Date.now()}.${getExtension(file.name)}`,
        outputName: `audio_${Date.now()}.${format}`,
        args,
        inputData: file,
        onProgress,
      })
    },
    [transcode],
  )

  /**
   * exportTimeline — render a simple concat of clips
   * (Full timeline render would need more complex EDL logic)
   */
  const exportVideo = useCallback(
    async (
      inputFile: File,
      format: 'mp4' | 'webm',
      cuts: Array<{ start: number; end: number }>,
      onProgress?: (p: number) => void,
    ) => {
      const ff = ffmpegRef.current
      if (!ff) throw new Error('FFmpeg not loaded')

      const ext = getExtension(inputFile.name)
      const inputName = `source.${ext}`
      const outputName = `export_${Date.now()}.${format}`

      await ff.writeFile(inputName, await fetchFile(inputFile))

      // Build trim/concat filter for cuts
      if (cuts.length === 0) {
        // No cuts — direct transcode
        const args =
          format === 'mp4'
            ? ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac']
            : ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-c:a', 'libopus']

        return transcode({
          inputName,
          outputName,
          args,
          inputData: inputFile,
          onProgress,
        })
      }

      // Build complex filtergraph for multiple segments
      const filterParts = cuts.map((c, i) => `[0:v]trim=${c.start}:${c.end},setpts=PTS-STARTPTS[v${i}];[0:a]atrim=${c.start}:${c.end},asetpts=PTS-STARTPTS[a${i}]`).join(';')
      const concatInputs = cuts.map((_, i) => `[v${i}][a${i}]`).join('')
      const filter = `${filterParts};${concatInputs}concat=n=${cuts.length}:v=1:a=1[vout][aout]`

      const progressHandler = ({ progress: p }: { progress: number }) => {
        onProgress?.(Math.round(p * 100))
      }
      ff.on('progress', progressHandler)

      try {
        await ff.exec([
          '-i', inputName,
          '-filter_complex', filter,
          '-map', '[vout]', '-map', '[aout]',
          ...(format === 'mp4'
            ? ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac']
            : ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-c:a', 'libopus']),
          outputName,
        ])

        const data = await ff.readFile(outputName) as Uint8Array
        const blob = new Blob([data], { type: getMimeType(outputName) })
        const objectUrl = URL.createObjectURL(blob)
        await ff.deleteFile(inputName).catch(() => {})
        await ff.deleteFile(outputName).catch(() => {})

        return { data, objectUrl }
      } finally {
        ff.off('progress', progressHandler)
      }
    },
    [transcode],
  )

  return {
    ffmpeg: ffmpegRef.current,
    isReady,
    isLoading,
    progress,
    logs,
    load,
    transcode,
    extractAudio,
    exportVideo,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getExtension(filename: string): string {
  return filename.split('.').pop() ?? 'bin'
}

function getMimeType(filename: string): string {
  const ext = getExtension(filename)
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
  }
  return map[ext] ?? 'application/octet-stream'
}
