import { useCallback, useEffect, useRef, useState } from 'react'

const TRACK_SOURCE = `${import.meta.env.BASE_URL}audio/swarm-instrumental.ogg`

export function useAmbientAudio() {
  const [enabled, setEnabled] = useState(false)
  const [supported] = useState(() => typeof Audio !== 'undefined')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const enabledRef = useRef(false)

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current
    const audio = new Audio(TRACK_SOURCE)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 1
    audioRef.current = audio
    return audio
  }, [])

  const toggle = useCallback(async () => {
    if (!supported) return
    if (!enabledRef.current) {
      const audio = ensureAudio()
      try {
        await audio.play()
        enabledRef.current = true
        setEnabled(true)
      } catch {
        enabledRef.current = false
        setEnabled(false)
      }
      return
    }
    enabledRef.current = false
    setEnabled(false)
    const audio = audioRef.current
    if (audio) audio.pause()
  }, [ensureAudio, supported])

  useEffect(() => {
    const onVisibility = () => {
      const audio = audioRef.current
      if (!audio) return
      if (document.hidden) audio.pause()
      else if (enabledRef.current) {
        void audio.play().catch(() => {
          enabledRef.current = false
          setEnabled(false)
        })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => () => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audioRef.current = null
  }, [])

  return { enabled, supported, toggle }
}
