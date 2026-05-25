import { useRef, useState, useEffect } from 'react'

interface Props {
  src: string
  onEnded?: () => void
  autoPlay?: boolean
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioPlayer({ src, onEnded, autoPlay = false }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = src
    setCurrentTime(0)
    setDuration(0)
    setLoading(true)
    setPlaying(false)
    if (autoPlay) {
      audio.play().catch(() => setPlaying(false))
    }
  }, [src, autoPlay])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlers = {
      loadedmetadata: () => { setDuration(audio.duration); setLoading(false) },
      timeupdate: () => setCurrentTime(audio.currentTime),
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      ended: () => { setPlaying(false); onEnded?.() },
      waiting: () => setLoading(true),
      canplay: () => setLoading(false),
    }

    Object.entries(handlers).forEach(([event, handler]) =>
      audio.addEventListener(event, handler as EventListener)
    )
    return () => {
      Object.entries(handlers).forEach(([event, handler]) =>
        audio.removeEventListener(event, handler as EventListener)
      )
    }
  }, [onEnded])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else audio.play().catch(() => setPlaying(false))
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    const t = parseFloat(e.target.value)
    audio.currentTime = t
    setCurrentTime(t)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 space-y-4">
      <audio ref={audioRef} preload="metadata" />

      {/* Play / Pause */}
      <div className="flex justify-center">
        <button
          onClick={togglePlay}
          disabled={loading}
          className="w-16 h-16 rounded-full bg-white text-blue-700 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : playing ? (
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Progress */}
      <div>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 rounded-full accent-white cursor-pointer"
          style={{
            background: `linear-gradient(to right, white ${progress}%, rgba(255,255,255,0.3) ${progress}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-white/60 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>
    </div>
  )
}
