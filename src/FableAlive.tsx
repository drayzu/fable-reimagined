import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  FABLE_WORLD_HEIGHT,
  FABLE_WORLD_WIDTH,
  fableWallTiles,
  worldYToWallPercent,
  type WallTileDefinition,
} from './fableAliveWorld'
import FableLivingCanvas from './FableLivingCanvas'
import { useAmbientAudio, type AmbientAudioSnapshot } from './useAmbientAudio'
import './fable-alive.css'

function tileStyle(tile: WallTileDefinition): CSSProperties {
  return {
    top: `${worldYToWallPercent(tile.worldY)}%`,
    height: `${worldYToWallPercent(tile.worldHeight)}%`,
  }
}

function FableAlive() {
  const wallRef = useRef<HTMLElement>(null)
  const audioSourceRef = useRef<AmbientAudioSnapshot>({ progress: 0, velocity: 0, reducedMotion: false })
  const [requested, setRequested] = useState<ReadonlySet<string>>(() => new Set(
    fableWallTiles.filter((tile) => tile.preload !== 'lazy').map((tile) => tile.id),
  ))
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set())
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const audio = useAmbientAudio(audioSourceRef)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(query.matches)
    query.addEventListener('change', updatePreference)
    return () => query.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    let previousScrollY = window.scrollY
    let previousTime = performance.now()
    const updateAudioSource = () => {
      const now = performance.now()
      const elapsed = Math.max(16, now - previousTime)
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const scrollVelocity = Math.abs(window.scrollY - previousScrollY) / elapsed
      audioSourceRef.current = {
        progress: Math.min(1, Math.max(0, window.scrollY / maxScroll)),
        velocity: Math.min(1, scrollVelocity / 3),
        reducedMotion: prefersReducedMotion,
      }
      previousScrollY = window.scrollY
      previousTime = now
    }

    updateAudioSource()
    window.addEventListener('scroll', updateAudioSource, { passive: true })
    window.addEventListener('resize', updateAudioSource, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateAudioSource)
      window.removeEventListener('resize', updateAudioSource)
    }
  }, [prefersReducedMotion])

  useEffect(() => {
    const previousTitle = document.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previousDescription = description?.content
    const previousThemeColor = themeColor?.content
    document.documentElement.classList.add('fable-alive-document')
    document.body.classList.add('fable-alive-page')
    document.title = 'Fable Alive — living study'
    if (description) description.content = 'A private living study of Fable: mutable language, rain, a searching maze mark, a click-awakened murmuration, and a travelling thread animate the drawn wall.'
    if (themeColor) themeColor.content = '#181410'
    return () => {
      document.documentElement.classList.remove('fable-alive-document')
      document.body.classList.remove('fable-alive-page')
      document.title = previousTitle
      if (description && previousDescription !== undefined) description.content = previousDescription
      if (themeColor && previousThemeColor !== undefined) themeColor.content = previousThemeColor
    }
  }, [])

  useEffect(() => {
    const wall = wallRef.current
    if (!wall || !('IntersectionObserver' in window)) {
      setRequested(new Set(fableWallTiles.map((tile) => tile.id)))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      const visibleIds = entries.filter((entry) => entry.isIntersecting).map((entry) => (entry.target as HTMLElement).dataset.tileId).filter(Boolean) as string[]
      if (!visibleIds.length) return
      setRequested((current) => {
        if (visibleIds.every((id) => current.has(id))) return current
        return new Set([...current, ...visibleIds])
      })
    }, { rootMargin: '220% 0px', threshold: 0 })
    wall.querySelectorAll<HTMLElement>('[data-lazy-tile]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  const markLoaded = (tileId: string, image: HTMLImageElement) => {
    void image.decode().catch(() => undefined).then(() => {
      setLoaded((current) => current.has(tileId) ? current : new Set([...current, tileId]))
    })
  }

  return (
    <main className="fable-alive-root">
      {audio.supported && (
        <button
          className={`sound-control is-visible is-night ${audio.enabled ? 'is-active' : ''}`}
          type="button"
          onClick={() => void audio.toggle()}
          aria-label={audio.enabled ? 'Turn sound off' : 'Turn sound on'}
          aria-pressed={audio.enabled}
        >
          <span className={`sound-glyph ${audio.enabled ? 'is-sounding' : ''}`} aria-hidden="true"><i /><i /><i /></span>
          <span>sound {audio.enabled ? 'on' : 'off'}</span>
        </button>
      )}

      <article className="sr-only" aria-labelledby="fable-alive-title">
        <h1 id="fable-alive-title">Fable Alive — living study</h1>
        <p>A private reconstruction of the complete Fable drawing wall. A typographic self continually rewrites its letters, rain passes through the garden, a small mark searches a labyrinth, a murmuration performs a collective flight when clicked, and a travelling glint follows the golden thread. Motion is decorative and becomes static when reduced motion is requested.</p>
      </article>

      <section
        ref={wallRef}
        className="fable-wall"
        aria-hidden="true"
        data-world-width={FABLE_WORLD_WIDTH}
        data-world-height={FABLE_WORLD_HEIGHT}
        style={{ height: `${FABLE_WORLD_HEIGHT / FABLE_WORLD_WIDTH * 100}vw` }}
      >
        {fableWallTiles.map((tile) => {
          const shouldRequest = requested.has(tile.id)
          return (
            <div
              className={`fable-wall-tile theme-${tile.theme} ${loaded.has(tile.id) ? 'is-loaded' : 'is-pending'}`}
              data-lazy-tile={tile.preload === 'lazy' ? '' : undefined}
              data-tile-id={tile.id}
              data-world-y={tile.worldY}
              key={tile.id}
              style={tileStyle(tile)}
            >
              {shouldRequest && (
                <img
                  alt=""
                  decoding="async"
                  draggable="false"
                  fetchPriority={tile.preload === 'eager' ? 'high' : 'auto'}
                  loading="eager"
                  onLoad={(event) => markLoaded(tile.id, event.currentTarget)}
                  src={tile.source}
                />
              )}
            </div>
          )
        })}

        <FableLivingCanvas />
      </section>
    </main>
  )
}

export default FableAlive
