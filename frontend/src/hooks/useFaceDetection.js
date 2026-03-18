/**
 * useFaceDetection — MediaPipe BlazeBlaze face detection hook.
 *
 * Uses @mediapipe/face_detection (already installed) to run real ML inference
 * on the candidate's webcam feed every DETECTION_INTERVAL ms.
 *
 * Returns:
 *  faceCount       — number of faces currently detected (0, 1, or 2+)
 *  confidence      — confidence score of the primary detection (0–1)
 *  boundingBox     — {xCenter, yCenter, width, height} of primary face (normalized)
 *  isLoaded        — whether the model has finished loading
 *  detectionActive — whether detection loop is running
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const DETECTION_INTERVAL = 1500   // ms between detection runs
const MODEL_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection'

export function useFaceDetection(videoRef, enabled = true) {
  const [faceCount, setFaceCount]       = useState(1) // optimistic start
  const [confidence, setConfidence]     = useState(0)
  const [boundingBox, setBoundingBox]   = useState(null)
  const [isLoaded, setIsLoaded]         = useState(false)
  const [detectionActive, setDetectionActive] = useState(false)

  const detectorRef  = useRef(null)
  const intervalRef  = useRef(null)
  const lastResults  = useRef([])

  // ── Load MediaPipe model ───────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const loadModel = async () => {
      try {
        // Dynamic import — model is already in node_modules
        const { FaceDetection } = await import('@mediapipe/face_detection')

        const detector = new FaceDetection({
          locateFile: (file) => `${MODEL_CDN}/${file}`,
        })

        detector.setOptions({
          model: 'short',          // 'short' = blazeblaze short-range, faster
          minDetectionConfidence: 0.5,
        })

        detector.onResults((results) => {
          if (cancelled) return
          const faces = results.detections ?? []
          lastResults.current = faces

          setFaceCount(faces.length)

          if (faces.length > 0) {
            const primary = faces[0]
            setConfidence(primary.score?.[0] ?? 0)
            const box = primary.boundingBox
            setBoundingBox(box ?? null)
          } else {
            setConfidence(0)
            setBoundingBox(null)
          }
        })

        await detector.initialize()
        if (!cancelled) {
          detectorRef.current = detector
          setIsLoaded(true)
        }
      } catch (err) {
        console.warn('[useFaceDetection] Failed to load MediaPipe:', err)
        // Fallback: mark as loaded anyway so app doesn't stall
        if (!cancelled) setIsLoaded(true)
      }
    }

    loadModel()
    return () => { cancelled = true }
  }, [enabled])

  // ── Start / stop detection loop when model is ready ───────────────────────
  useEffect(() => {
    if (!isLoaded || !enabled || !detectorRef.current) return

    const runDetection = async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || video.paused) return

      try {
        await detectorRef.current.send({ image: video })
      } catch {
        // silently ignore per-frame errors
      }
    }

    setDetectionActive(true)
    intervalRef.current = setInterval(runDetection, DETECTION_INTERVAL)

    return () => {
      clearInterval(intervalRef.current)
      setDetectionActive(false)
    }
  }, [isLoaded, enabled, videoRef])

  // ── Fallback pixel analysis (safety net if MediaPipe fails) ───────────────
  const pixelFallback = useCallback(() => {
    const video = videoRef.current
    if (!video || !isLoaded) return 1 // optimistic fallback

    try {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 120
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, 160, 120)
      const data = ctx.getImageData(0, 0, 160, 120).data
      let skinPixels = 0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) skinPixels++
      }
      return skinPixels / (160 * 120 / 4) > 0.03 ? 1 : 0
    } catch {
      return 1
    }
  }, [videoRef, isLoaded])

  const stopDetection = useCallback(() => {
    clearInterval(intervalRef.current)
    setDetectionActive(false)
  }, [])

  return { faceCount, confidence, boundingBox, isLoaded, detectionActive, pixelFallback, stopDetection }
}
