/**
 * useGazeDetection — Eye-gaze direction detection using MediaPipe FaceMesh.
 *
 * Computes gaze direction from 6 eye-corner and iris landmark points.
 * Fires `looking_away` when gaze deviates beyond threshold for 2+ consecutive frames.
 *
 * MediaPipe FaceMesh landmark indices used:
 *   Left eye:  outer=33,  inner=133, top=159, bottom=145, iris=468
 *   Right eye: outer=362, inner=263, top=386, bottom=374, iris=473
 *
 * Returns:
 *  gazeDirection   — 'center' | 'left' | 'right' | 'up' | 'down'
 *  gazeScore       — 0–1 how centered the gaze is (1 = perfect center)
 *  isLookingAway   — boolean
 *  isLoaded        — model loaded
 */

import { useState, useEffect, useRef } from 'react'

const DETECTION_INTERVAL  = 2000   // ms
const GAZE_THRESHOLD      = 0.28   // iris ratio deviation threshold
const CONSECUTIVE_FRAMES  = 2      // frames before flagging
const MODEL_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'

// ── Landmark helpers ────────────────────────────────────────────────────────

function getLandmark(lms, idx) {
  return lms[idx] ? { x: lms[idx].x, y: lms[idx].y } : null
}

function computeGaze(landmarks) {
  if (!landmarks || landmarks.length < 478) return null

  // ── Horizontal gaze: compare iris x to eye corners ──────────────────────
  const leftIris  = getLandmark(landmarks, 468)
  const leftOuter = getLandmark(landmarks, 33)
  const leftInner = getLandmark(landmarks, 133)

  const rightIris  = getLandmark(landmarks, 473)
  const rightOuter = getLandmark(landmarks, 362)
  const rightInner = getLandmark(landmarks, 263)

  if (!leftIris || !leftOuter || !leftInner || !rightIris || !rightOuter || !rightInner) {
    return null
  }

  // Left eye: ratio of (iris - outer) / (inner - outer), 0=outer, 1=inner
  const leftWidth  = Math.abs(leftInner.x - leftOuter.x)
  const leftRatio  = leftWidth > 0 ? (leftIris.x - leftOuter.x) / leftWidth : 0.5

  // Right eye: same direction (outer is now on right side)
  const rightWidth = Math.abs(rightInner.x - rightOuter.x)
  const rightRatio = rightWidth > 0 ? (rightIris.x - rightInner.x) / rightWidth : 0.5

  // Average horizontal position (0 = fully right, 1 = fully left)
  const hRatio = (leftRatio + (1 - rightRatio)) / 2

  // ── Vertical gaze: compare iris y to eye top/bottom ─────────────────────
  const leftTop    = getLandmark(landmarks, 159)
  const leftBottom = getLandmark(landmarks, 145)
  const rightTop   = getLandmark(landmarks, 386)
  const rightBottom = getLandmark(landmarks, 374)

  let vRatio = 0.5
  if (leftTop && leftBottom && rightTop && rightBottom) {
    const leftH  = Math.abs(leftBottom.y - leftTop.y)
    const rightH = Math.abs(rightBottom.y - rightTop.y)
    const lv = leftH  > 0 ? (leftIris.y  - leftTop.y)  / leftH  : 0.5
    const rv = rightH > 0 ? (rightIris.y - rightTop.y) / rightH : 0.5
    vRatio = (lv + rv) / 2
  }

  // ── Determine direction ───────────────────────────────────────────────────
  const hDev = Math.abs(hRatio - 0.5)
  const vDev = Math.abs(vRatio - 0.5)
  const gazeScore = 1 - Math.max(hDev, vDev) * 2

  let direction = 'center'
  if (hDev > GAZE_THRESHOLD) {
    direction = hRatio < 0.5 ? 'right' : 'left'
  } else if (vDev > GAZE_THRESHOLD) {
    direction = vRatio < 0.5 ? 'up' : 'down'
  }

  return { direction, gazeScore: Math.max(0, Math.min(1, gazeScore)), hRatio, vRatio }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGazeDetection(videoRef, enabled = true) {
  const [gazeDirection, setGazeDirection] = useState('center')
  const [gazeScore, setGazeScore]         = useState(1)
  const [isLookingAway, setIsLookingAway] = useState(false)
  const [isLoaded, setIsLoaded]           = useState(false)

  const meshRef         = useRef(null)
  const intervalRef     = useRef(null)
  const awayCount       = useRef(0)       // consecutive look-away frames

  // ── Load FaceMesh model ───────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const load = async () => {
      try {
        const { FaceMesh } = await import('@mediapipe/face_mesh')

        const mesh = new FaceMesh({
          locateFile: (file) => `${MODEL_CDN}/${file}`,
        })

        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,    // enables iris landmarks (468–477)
          minDetectionConfidence: 0.5,
          minTrackingConfidence:  0.5,
        })

        mesh.onResults((results) => {
          if (cancelled) return
          const ml = results.multiFaceLandmarks
          if (!ml || ml.length === 0) {
            awayCount.current = 0
            setGazeDirection('center')
            setGazeScore(1)
            setIsLookingAway(false)
            return
          }

          const gaze = computeGaze(ml[0])
          if (!gaze) return

          setGazeDirection(gaze.direction)
          setGazeScore(gaze.gazeScore)

          if (gaze.direction !== 'center') {
            awayCount.current++
            if (awayCount.current >= CONSECUTIVE_FRAMES) {
              setIsLookingAway(true)
            }
          } else {
            awayCount.current = 0
            setIsLookingAway(false)
          }
        })

        await mesh.initialize()
        if (!cancelled) {
          meshRef.current = mesh
          setIsLoaded(true)
        }
      } catch (err) {
        console.warn('[useGazeDetection] FaceMesh load failed:', err)
        if (!cancelled) setIsLoaded(true) // degrade gracefully
      }
    }

    load()
    return () => { cancelled = true }
  }, [enabled])

  // ── Detection loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !enabled || !meshRef.current) return

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || video.paused) return
      try {
        await meshRef.current.send({ image: video })
      } catch { /* ignore per-frame errors */ }
    }, DETECTION_INTERVAL)

    return () => clearInterval(intervalRef.current)
  }, [isLoaded, enabled, videoRef])

  return { gazeDirection, gazeScore, isLookingAway, isLoaded }
}
