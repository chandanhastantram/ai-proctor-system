/**
 * useProctoringEngine — Master orchestrator for all proctoring channels.
 *
 * Coordinates:
 *  1. useFaceDetection   → no_face / multiple_faces violations
 *  2. useGazeDetection   → looking_away violations
 *  3. useAudioMonitor    → audio_detected violations
 *  4. Browser events     → tab_switch / window_blur / copy_paste / right_click
 *  5. WebSocket          → sends all events to backend, receives integrity updates
 *  6. Screenshot capture → captures canvas frame on high-severity violations
 *
 * Usage:
 *   const {
 *     integrityScore, wsConnected, faceCount, audioLevel, gazeDirection,
 *     violations, micEnabled, cameraEnabled, isTerminated,
 *     sendProctorEvent, startCamera, stopAll
 *   } = useProctoringEngine({ sessionId, videoRef })
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useFaceDetection } from './useFaceDetection'
import { useGazeDetection } from './useGazeDetection'
import { useAudioMonitor } from './useAudioMonitor'
import { ENDPOINTS } from '../config/endpoints'
import axios from 'axios'

// ── Config ──────────────────────────────────────────────────────────────────
const HIGH_SEVERITY_EVENTS = new Set(['multiple_faces', 'face_mismatch'])
const KEYBOARD_BLOCK_KEYS  = new Set(['F12', 'F5'])
const HEARTBEAT_INTERVAL   = 20_000   // ms between WS ping messages
const WS_RECONNECT_DELAY   = 3_000   // ms before reconnect attempt

// ── Screenshot helper ────────────────────────────────────────────────────────
async function captureScreenshot(videoEl, sessionId) {
  if (!videoEl) return
  try {
    const canvas = document.createElement('canvas')
    canvas.width  = videoEl.videoWidth  || 640
    canvas.height = videoEl.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoEl, 0, 0)
    // Mirror to match display
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(videoEl, -canvas.width, 0)
    ctx.restore()
    const b64 = canvas.toDataURL('image/jpeg', 0.7)

    await axios.post(ENDPOINTS.VIOLATIONS.SCREENSHOT, {
      session_id: sessionId,
      screenshot_b64: b64,
    }).catch(() => {}) // non-critical — never block on screenshot
  } catch { /* ignore */ }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useProctoringEngine({ sessionId, videoRef, onViolation, onTerminated }) {
  // ── States ──────────────────────────────────────────────────────────────────
  const [integrityScore, setIntegrityScore] = useState(100)
  const [wsConnected,    setWsConnected]    = useState(false)
  const [violations,     setViolations]     = useState([])
  const [isTerminated,   setIsTerminated]   = useState(false)
  const [cameraEnabled,  setCameraEnabled]  = useState(false)

  // ── Sub-hooks ────────────────────────────────────────────────────────────────
  const { faceCount, boundingBox, isLoaded: faceLoaded } =
    useFaceDetection(videoRef, true)

  const { gazeDirection, gazeScore, isLookingAway, isLoaded: gazeLoaded } =
    useGazeDetection(videoRef, true)

  const {
    audioLevel, isSpeaking, isWhispering, micEnabled,
    startAudio, stopAudio, setOnSpeaking, setOnWhisper,
  } = useAudioMonitor()

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const wsRef           = useRef(null)
  const streamRef       = useRef(null)
  const heartbeatRef    = useRef(null)
  const reconnectRef    = useRef(null)
  const terminatedRef   = useRef(false)

  // Debounce: track last-sent time per event type (client-side cooldown)
  const lastSentRef = useRef({})
  const CLIENT_COOLDOWNS = {
    no_face:        8000,
    multiple_faces: 12000,
    looking_away:   5000,
    audio_detected: 8000,
    tab_switch:     4000,
    window_blur:    4000,
    copy_paste:     4000,
  }

  // ── WebSocket ───────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (terminatedRef.current) return

    const ws = new WebSocket(ENDPOINTS.WS.PROCTORING(sessionId))
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'ping' }))
        }
      }, HEARTBEAT_INTERVAL)
    }

    ws.onclose = () => {
      setWsConnected(false)
      clearInterval(heartbeatRef.current)
      // Auto-reconnect unless terminated
      if (!terminatedRef.current) {
        reconnectRef.current = setTimeout(connectWS, WS_RECONNECT_DELAY)
      }
    }

    ws.onerror = () => {
      setWsConnected(false)
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)

        if (msg.status === 'violation_logged') {
          setIntegrityScore(msg.integrity_score)
          const toast = { ...msg, id: Date.now() }
          setViolations(prev => [...prev.slice(-3), toast])
          setTimeout(() => {
            setViolations(prev => prev.filter(v => v.id !== toast.id))
          }, 5000)
          onViolation?.(toast)
        } else if (msg.status === 'terminated') {
          setIntegrityScore(msg.integrity_score)
          setIsTerminated(true)
          terminatedRef.current = true
          clearInterval(heartbeatRef.current)
          onTerminated?.(msg)
        }
      } catch { /* ignore malformed */ }
    }
  }, [sessionId, onViolation, onTerminated])

  // ── Send proctoring event (with client-side cooldown) ──────────────────────
  const sendProctorEvent = useCallback((eventType, detail = '') => {
    if (terminatedRef.current) return

    const now = Date.now()
    const cooldown = CLIENT_COOLDOWNS[eventType] ?? 5000
    const lastSent = lastSentRef.current[eventType] ?? 0
    if (now - lastSent < cooldown) return   // client-side throttle

    lastSentRef.current[eventType] = now

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: eventType, data: { detail } }))
    }

    // Capture screenshot for high-severity events
    if (HIGH_SEVERITY_EVENTS.has(eventType) && videoRef.current) {
      captureScreenshot(videoRef.current, sessionId)
    }
  }, [sessionId, videoRef])

  // ── Browser behavioral events ───────────────────────────────────────────────
  useEffect(() => {
    const onBlur = () =>
      sendProctorEvent('window_blur', 'Browser window lost focus')

    const onVisChange = () => {
      if (document.hidden) sendProctorEvent('tab_switch', 'Switched away from interview tab')
    }

    const onCopy  = () => sendProctorEvent('copy_paste', 'Ctrl+C copy detected')
    const onPaste = () => sendProctorEvent('copy_paste', 'Ctrl+V paste detected')
    const onCut   = () => sendProctorEvent('copy_paste', 'Ctrl+X cut detected')

    // Right-click block
    const onContextMenu = (e) => {
      e.preventDefault()
      sendProctorEvent('copy_paste', 'Right-click menu attempted')
    }

    // Keyboard shortcut blocking
    const onKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey
      // Block F12 (DevTools), Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (view source)
      if (KEYBOARD_BLOCK_KEYS.has(e.key)) { e.preventDefault(); return }
      if (ctrl && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
        e.preventDefault()
        sendProctorEvent('copy_paste', 'DevTools shortcut attempted')
      }
      if (ctrl && e.key === 'u') { e.preventDefault() }
      if (e.key === 'PrintScreen') {
        sendProctorEvent('copy_paste', 'PrintScreen key pressed')
      }
    }

    window.addEventListener('blur',             onBlur)
    document.addEventListener('visibilitychange', onVisChange)
    document.addEventListener('copy',           onCopy)
    document.addEventListener('paste',          onPaste)
    document.addEventListener('cut',            onCut)
    document.addEventListener('contextmenu',    onContextMenu)
    window.addEventListener('keydown',          onKeyDown, { capture: true })

    return () => {
      window.removeEventListener('blur',            onBlur)
      document.removeEventListener('visibilitychange', onVisChange)
      document.removeEventListener('copy',          onCopy)
      document.removeEventListener('paste',         onPaste)
      document.removeEventListener('cut',           onCut)
      document.removeEventListener('contextmenu',   onContextMenu)
      window.removeEventListener('keydown',         onKeyDown, { capture: true })
    }
  }, [sendProctorEvent])

  // ── Face detection → violations ─────────────────────────────────────────────
  useEffect(() => {
    if (!faceLoaded) return
    if (faceCount === 0) {
      sendProctorEvent('no_face', 'No face visible in camera')
    } else if (faceCount >= 2) {
      sendProctorEvent('multiple_faces', `${faceCount} faces detected`)
    }
  }, [faceCount, faceLoaded, sendProctorEvent])

  // ── Gaze detection → violations ─────────────────────────────────────────────
  useEffect(() => {
    if (!gazeLoaded || !isLookingAway) return
    sendProctorEvent('looking_away', `Looking ${gazeDirection}`)
  }, [isLookingAway, gazeDirection, gazeLoaded, sendProctorEvent])

  // ── Audio monitoring → violations ────────────────────────────────────────────
  useEffect(() => {
    setOnSpeaking(() => () => {
      sendProctorEvent('audio_detected', 'Sustained speech detected during exam')
    })
    setOnWhisper(() => () => {
      sendProctorEvent('audio_detected', 'Soft audio/whispering detected')
    })
  }, [setOnSpeaking, setOnWhisper, sendProctorEvent])

  // ── Camera startup ───────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraEnabled(true)
      return true
    } catch (err) {
      console.warn('[useProctoringEngine] Camera access denied:', err)
      setCameraEnabled(false)
      return false
    }
  }, [videoRef])

  // ── Full shutdown ─────────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    terminatedRef.current = true
    clearInterval(heartbeatRef.current)
    clearTimeout(reconnectRef.current)
    wsRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    stopAudio()
  }, [stopAudio])

  // ── Lifecycle — connect WS and start audio ────────────────────────────────────
  useEffect(() => {
    connectWS()
    startAudio()
    return () => {
      clearInterval(heartbeatRef.current)
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [])   // run once on mount

  return {
    // State
    integrityScore,
    wsConnected,
    violations,
    isTerminated,
    cameraEnabled,
    // Face
    faceCount,
    boundingBox,
    faceModelLoaded: faceLoaded,
    // Gaze
    gazeDirection,
    gazeScore,
    isLookingAway,
    gazeModelLoaded: gazeLoaded,
    // Audio
    audioLevel,
    isSpeaking,
    isWhispering,
    micEnabled,
    // Actions
    sendProctorEvent,
    startCamera,
    stopAll,
  }
}
