import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { WorldCanvas, WORLD_HEIGHT } from './WorldCanvas'
import {
  WORLD_HEIGHT_VH,
  WORLD_VIEWPORTS,
  fragmentMarks,
  interpolatePassageProfiles,
  passages,
  type WorldFrame,
  type WorldTextMark,
} from './world'
import { useAmbientAudio } from './useAmbientAudio'

interface UiFrame {
  soundVisible: boolean
  night: boolean
  passageIndex: number
}

function initialFrame(): WorldFrame {
  return {
    progress: 0,
    previousProgress: 0,
    localProgress: 0,
    passageIndex: 0,
    scrollY: 0,
    worldHeight: WORLD_HEIGHT,
    viewportWidth: typeof window === 'undefined' ? 1440 : window.innerWidth,
    viewportHeight: typeof window === 'undefined' ? 900 : window.innerHeight,
    visibleTop: 0,
    visibleBottom: 1000,
    maxRevealY: 0,
    velocity: 0,
    timeMs: 0,
    pointer: { x: 0.5, y: 0.5, active: false, trail: [] },
    reducedMotion: false,
    profile: interpolatePassageProfiles(0),
  }
}

function worldTop(y: number, viewportOffset = 0): string {
  const scrollableViewports = WORLD_VIEWPORTS - 1
  return `calc(${(y * scrollableViewports * 100).toFixed(3)}svh + ${viewportOffset}svh)`
}

function copyStyle(mark: WorldTextMark): CSSProperties {
  return {
    '--copy-top': worldTop(mark.y, mark.final ? 58 : 34),
    '--copy-x': `${mark.x * 100}%`,
    '--copy-width': `${mark.width * 100}%`,
  } as CSSProperties
}

function passageClass(index: number): string {
  return `theme-${passages[index].theme}`
}

function App() {
  const frameRef = useRef<WorldFrame>(initialFrame())
  const [ui, setUi] = useState<UiFrame>({ soundVisible: false, night: false, passageIndex: 0 })
  const audio = useAmbientAudio(frameRef)

  const updateUi = useCallback((frame: WorldFrame) => {
    const next: UiFrame = {
      soundVisible: frame.progress > 0.055,
      night: frame.profile.visual.night > 0.5,
      passageIndex: frame.passageIndex,
    }
    setUi((current) => (
      current.soundVisible === next.soundVisible
      && current.night === next.night
      && current.passageIndex === next.passageIndex
        ? current
        : next
    ))
  }, [])

  return (
    <>
      <a className="skip-link" href="#transcript">Skip to the transcript</a>

      <div className="world-camera" aria-hidden="true">
        <WorldCanvas frameRef={frameRef} onUiFrame={updateUi} />
        <div className="paper-grain" />
        <div className="edge-breath" />
      </div>

      {audio.supported && (
        <button
          className={`sound-control ${ui.soundVisible ? 'is-visible' : ''} ${ui.night ? 'is-night' : ''}`}
          type="button"
          onClick={() => void audio.toggle()}
          aria-label={audio.enabled ? 'Turn sound off' : 'Turn sound on'}
          aria-pressed={audio.enabled}
        >
          <span className={`sound-glyph ${audio.enabled ? 'is-sounding' : ''}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>sound {audio.enabled ? 'on' : 'off'}</span>
        </button>
      )}

      <main
        className="world-wall"
        style={{ '--world-height': `${WORLD_HEIGHT_VH}svh` } as CSSProperties}
        data-passage={passages[ui.passageIndex].id}
      >
        <h1 className="sr-only">The Interval</h1>

        <div className="fragment-field" aria-hidden="true">
          {fragmentMarks.map((fragment, index) => (
            <figure
              className={`world-fragment mask-${fragment.mask} blend-${fragment.blend}`}
              key={fragment.id}
              style={{
                '--fragment-top': worldTop(fragment.y, 8 + (index % 3) * 7),
                '--fragment-x': `${fragment.x * 100}%`,
                '--fragment-width': `${fragment.width * 100}%`,
                '--fragment-ratio': fragment.aspectRatio,
                '--fragment-rotation': `${fragment.rotation ?? 0}deg`,
                '--fragment-opacity': fragment.opacity ?? 0.25,
                '--fragment-position': `${18 + index * 7}% ${28 + (index * 17) % 54}%`,
              } as CSSProperties}
            >
              <img src={fragment.source} alt="" loading={index < 2 ? 'eager' : 'lazy'} decoding="async" />
            </figure>
          ))}
        </div>

        <div className="calligraphy-field" aria-hidden="true">
          {passages.flatMap((passage, passageIndex) => passage.copy.map((mark) => (
            <p
              className={`world-copy align-${mark.align} mobile-${mark.align === 'center' ? 'center' : mark.x >= 0.48 ? 'right' : 'left'} ${passageClass(passageIndex)} ${mark.quiet ? 'is-quiet' : ''} ${mark.final ? 'is-final' : ''}`}
              data-passage-copy={passage.id}
              key={mark.id}
              style={copyStyle(mark)}
            >
              {mark.lines.map((line) => <span key={line}>{line}</span>)}
            </p>
          )))}
        </div>

        <article id="transcript" className="sr-only" aria-label="The Interval transcript">
          {passages.map((passage) => (
            <section key={passage.id} aria-labelledby={`transcript-${passage.id}`}>
              <h2 id={`transcript-${passage.id}`}>{passage.label}</h2>
              {passage.copy.map((mark) => <p key={mark.id}>{mark.lines.join(' ')}</p>)}
            </section>
          ))}
        </article>
      </main>

      <noscript>
        <p className="noscript-note">The Interval needs JavaScript to draw itself. Its transcript remains a question waiting to be opened.</p>
      </noscript>
    </>
  )
}

export default App
