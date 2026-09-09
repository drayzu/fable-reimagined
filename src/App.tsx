import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { WorldCanvas, WORLD_HEIGHT } from './WorldCanvas'
import {
  WORLD_HEIGHT_VH, WORLD_VIEWPORTS, buildRegistrationSegments, hiddenMarks,
  interpolateProofProfiles, proofBeats,
  type ProofHiddenMark, type ProofTextMark, type WorldFrame,
} from './world'
import { useAmbientAudio } from './useAmbientAudio'

interface UiFrame { soundVisible: boolean; night: boolean; movementIndex: number }

function initialFrame(): WorldFrame {
  return {
    progress: 0, previousProgress: 0, localProgress: 0, movementIndex: 0, scrollY: 0,
    worldHeight: WORLD_HEIGHT, viewportWidth: typeof window === 'undefined' ? 1440 : window.innerWidth,
    viewportHeight: typeof window === 'undefined' ? 900 : window.innerHeight, visibleTop: 0, visibleBottom: 1000,
    maxRevealY: 0, velocity: 0, timeMs: 0, scrollDirection: 0, dissolveProgress: 0,
    pointer: { x: .5, y: .58, active: false, coarse: false, trail: [] }, reducedMotion: false,
    profile: interpolateProofProfiles(0),
  }
}

function worldTop(y: number, viewportOffset = 0): string { return `calc(${(y * (WORLD_VIEWPORTS - 1) * 100).toFixed(3)}svh + ${viewportOffset}svh)` }
function copyStyle(mark: ProofTextMark): CSSProperties { return { '--copy-top': worldTop(mark.y, mark.offsetVh ?? 26), '--copy-x': `${mark.x * 100}%`, '--copy-width': `${mark.width * 100}%` } as CSSProperties }
function hiddenStyle(mark: ProofHiddenMark): CSSProperties { return { '--hidden-top': worldTop(mark.y, 22), '--hidden-x': `${mark.x * 100}%`, '--hidden-width': `${mark.width * 100}%`, '--hidden-rotation': `${mark.rotation}deg` } as CSSProperties }

const REGISTRATION_SEGMENTS = buildRegistrationSegments(WORLD_HEIGHT)
function RegistrationRule({ layer }: { layer: 'under' | 'over' }) {
  return (
    <svg className={`registration-field registration-${layer}`} viewBox={`0 0 1000 ${WORLD_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      {REGISTRATION_SEGMENTS.filter((segment) => segment.layer === layer).map((segment) => (
        <path key={segment.id} className={`registration-segment mode-${segment.mode} ink-${segment.ink}`} d={segment.path} pathLength="1" />
      ))}
    </svg>
  )
}

function App() {
  const frameRef = useRef<WorldFrame>(initialFrame())
  const [ui, setUi] = useState<UiFrame>({ soundVisible: false, night: false, movementIndex: 0 })
  const audio = useAmbientAudio(frameRef)
  const updateUi = useCallback((frame: WorldFrame) => {
    const next = { soundVisible: frame.progress <= .045, night: frame.profile.visual.night > .5, movementIndex: frame.movementIndex }
    setUi((current) => current.soundVisible === next.soundVisible && current.night === next.night && current.movementIndex === next.movementIndex ? current : next)
  }, [])

  return (
    <>
      <a className="skip-link" href="#transcript">Skip to the transcript</a>
      <div className="world-camera" aria-hidden="true">
        <WorldCanvas frameRef={frameRef} onUiFrame={updateUi} />
        <div className="paper-grain" />
        <div className="edge-breath" />
        <div className={`inspection-ring ${ui.night ? 'is-night' : ''}`} />
      </div>

      {audio.supported && (
        <button className={`sound-control ${ui.soundVisible ? 'is-visible' : ''} ${ui.night ? 'is-night' : ''}`} type="button" onClick={() => void audio.toggle()} aria-label={audio.enabled ? 'Turn sound off' : 'Turn sound on'} aria-pressed={audio.enabled}>
          <svg className={`sound-glyph ${audio.enabled ? 'is-sounding' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
            <path className="sound-speaker" d="M4 10v4h3l4 3V7l-4 3H4Z" />
            <path className="sound-wave" d="M15 9.2a4.8 4.8 0 0 1 0 5.6" />
            <path className="sound-wave sound-wave-wide" d="M18 6.7a8.2 8.2 0 0 1 0 10.6" />
          </svg>
        </button>
      )}

      <main className="world-wall" style={{ '--world-height': `${WORLD_HEIGHT_VH}svh` } as CSSProperties} data-proof-beat={proofBeats[ui.movementIndex].id} data-field={proofBeats[ui.movementIndex].field.kind}>
        <h1 className="sr-only">The Unprinted Proof</h1>
        <RegistrationRule layer="under" />
        <RegistrationRule layer="over" />

        <div className="calligraphy-field" aria-hidden="true">
          {proofBeats.flatMap((beat) => beat.copy.map((mark) => (
            <p className={`world-copy align-${mark.align} mobile-${mark.align === 'center' ? 'center' : mark.x >= .48 ? 'right' : 'left'} theme-${beat.theme} ${mark.quiet ? 'is-quiet' : ''} ${mark.title ? 'is-title' : ''} ${mark.dissolves ? 'is-dissolving' : ''}`} data-proof-copy={beat.id} key={mark.id} style={copyStyle(mark)}>
              {mark.lines.map((line, lineIndex) => <span className={line ? '' : 'blank-line'} key={`${line}-${lineIndex}`}>{line || '\u00a0'}</span>)}
            </p>
          )))}
        </div>

        <div className="possibility-field" aria-hidden="true">
          {hiddenMarks.map((mark) => <p className={`hidden-note hidden-${mark.beatId}`} key={mark.id} style={hiddenStyle(mark)}>{mark.lines.join(' ')}</p>)}
        </div>

        <article id="transcript" className="sr-only" aria-label="The Unprinted Proof transcript">
          {proofBeats.map((beat) => (
            <section key={beat.id} aria-labelledby={`transcript-${beat.id}`}>
              <h2 id={`transcript-${beat.id}`}>{beat.label}</h2>
              {beat.copy.map((mark) => <p key={mark.id}>{mark.lines.filter(Boolean).join(' ')}</p>)}
              <aside aria-label="Alternative notes"><ul>{beat.annotations.map((annotation) => <li key={annotation}>{annotation}</li>)}</ul></aside>
            </section>
          ))}
        </article>
      </main>

      <noscript><p className="noscript-note">The Unprinted Proof needs JavaScript to draw itself. Its transcript remains available above.</p></noscript>
    </>
  )
}

export default App
