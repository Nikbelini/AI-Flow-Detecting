import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

type Props = {
  src: string
  autoPlay?: boolean
  muted?: boolean
  controls?: boolean
  poster?: string
  playsInline?: boolean
  onError?: (e: unknown) => void
}

export default function HlsPlayer({
  src,
  autoPlay = false,
  muted = false,
  controls = true,
  poster,
  playsInline = true,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.load()
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      })
      hlsRef.current = hls
      hls.attachMedia(video)
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src))
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
          else hls.destroy()
        }
        onError?.(data)
      })
    } else {
      onError?.(new Error('HLS is not supported'))
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src, onError])

  return (
    <video
      ref={videoRef}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      playsInline={playsInline}
      poster={poster}
      style={{ width: '100%', height: 'auto' }}
    />
  )
}