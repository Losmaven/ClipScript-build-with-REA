/**
 * useMediaPlayer — manages HTML5 video/audio element playback
 * synchronized with the global timeline store.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useMediaPlayer(mediaUrl: string | undefined) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)

  const isPlaying    = useAppStore((s) => s.isPlaying)
  const currentTime  = useAppStore((s) => s.currentTime)
  const playbackRate = useAppStore((s) => s.playbackRate)
  const volume       = useAppStore((s) => s.volume)
  const isMuted      = useAppStore((s) => s.isMuted)

  const setCurrentTime = useAppStore((s) => s.setCurrentTime)
  const setIsPlaying   = useAppStore((s) => s.setIsPlaying)

  // ── Sync play/pause ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    if (isPlaying) {
      el.play().catch(() => setIsPlaying(false))
    } else {
      el.pause()
    }
  }, [isPlaying, setIsPlaying])

  // ── Sync playback rate ────────────────────────────────────────────────────
  useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // ── Sync volume ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = volume
      mediaRef.current.muted = isMuted
    }
  }, [volume, isMuted])

  // ── External seek (store → element) ──────────────────────────────────────
  // Only seek if the difference is meaningful to avoid feedback loop
  const lastSeekedTime = useRef<number>(-1)
  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    if (Math.abs(el.currentTime - currentTime) > 0.15) {
      el.currentTime = currentTime
      lastSeekedTime.current = currentTime
    }
  }, [currentTime])

  // ── Wire up element event listeners ──────────────────────────────────────
  const attachElement = useCallback(
    (el: HTMLVideoElement | HTMLAudioElement | null) => {
      if (!el) { mediaRef.current = null; return }
      mediaRef.current = el

      const onTimeUpdate = () => {
        if (Math.abs(el.currentTime - lastSeekedTime.current) > 0.05) {
          setCurrentTime(el.currentTime)
        }
      }
      const onEnded = () => setIsPlaying(false)
      const onPlay  = () => setIsPlaying(true)
      const onPause = () => setIsPlaying(false)

      el.addEventListener('timeupdate', onTimeUpdate)
      el.addEventListener('ended', onEnded)
      el.addEventListener('play', onPlay)
      el.addEventListener('pause', onPause)

      return () => {
        el.removeEventListener('timeupdate', onTimeUpdate)
        el.removeEventListener('ended', onEnded)
        el.removeEventListener('play', onPlay)
        el.removeEventListener('pause', onPause)
      }
    },
    [setCurrentTime, setIsPlaying],
  )

  const play  = useCallback(() => setIsPlaying(true), [setIsPlaying])
  const pause = useCallback(() => setIsPlaying(false), [setIsPlaying])
  const seek  = useCallback((t: number) => {
    setCurrentTime(t)
    if (mediaRef.current) mediaRef.current.currentTime = t
  }, [setCurrentTime])

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  return { mediaRef, attachElement, play, pause, seek, togglePlay }
}
