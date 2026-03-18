/**
 * useAudioMonitor — Browser microphone audio monitoring via Web Audio API.
 *
 * Architecture:
 *   getUserMedia(audio) → AudioContext → MediaStreamSourceNode
 *     → AnalyserNode → reads getByteFrequencyData() every POLL_INTERVAL ms
 *
 * Thresholds:
 *   RMS > VOICE_THRESHOLD (40)   → sustained speech → fire audio_detected (severity 2)
 *   RMS 20–40                    → whisper/background → fire audio_detected (severity 1)
 *   Sustained > SUSTAIN_DURATION → violation when sustained above threshold
 *
 * Returns:
 *  audioLevel        — current RMS 0–100
 *  isSpeaking        — true when voice threshold exceeded for SUSTAIN_DURATION
 *  isWhispering      — true when in whisper range
 *  micEnabled        — user granted mic permission
 *  startAudio()      — start monitoring (call after camera is ready)
 *  stopAudio()       — cleanup
 */

import { useState, useRef, useCallback } from 'react'

const POLL_INTERVAL     = 500   // ms between RMS reads
const VOICE_THRESHOLD   = 40    // RMS threshold for speech
const WHISPER_THRESHOLD = 18    // RMS threshold for soft audio
const SUSTAIN_DURATION  = 1500  // ms audio must be sustained before flagging
const FFT_SIZE          = 256

function calculateRMS(frequencyData) {
  let sum = 0
  for (let i = 0; i < frequencyData.length; i++) {
    sum += frequencyData[i] * frequencyData[i]
  }
  return Math.sqrt(sum / frequencyData.length)
}

export function useAudioMonitor() {
  const [audioLevel, setAudioLevel]     = useState(0)
  const [isSpeaking, setIsSpeaking]     = useState(false)
  const [isWhispering, setIsWhispering] = useState(false)
  const [micEnabled, setMicEnabled]     = useState(false)

  const audioCtxRef   = useRef(null)
  const analyserRef   = useRef(null)
  const streamRef     = useRef(null)
  const pollRef       = useRef(null)
  const freqBufRef    = useRef(null)

  // Sustained-speech tracking
  const aboveVoiceAt    = useRef(null)
  const aboveWhisperAt  = useRef(null)
  const speakingRef     = useRef(false)
  const whisperingRef   = useRef(false)

  /**
   * Callbacks fired when audio thresholds are crossed.
   * Stored as refs so the caller can set them once.
   */
  const onSpeakingRef   = useRef(null)
  const onWhisperRef    = useRef(null)

  const setOnSpeaking = useCallback((fn) => { onSpeakingRef.current = fn }, [])
  const setOnWhisper  = useCallback((fn) => { onWhisperRef.current  = fn }, [])

  const stopAudio = useCallback(() => {
    clearInterval(pollRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    streamRef.current  = null
    audioCtxRef.current = null
    analyserRef.current = null
    freqBufRef.current  = null
    setAudioLevel(0)
    setIsSpeaking(false)
    setIsWhispering(false)
    speakingRef.current   = false
    whisperingRef.current = false
    aboveVoiceAt.current  = null
    aboveWhisperAt.current = null
  }, [])

  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,   // keep raw signal for better detection
          noiseSuppression: false,
          sampleRate: 16000,
        },
        video: false,
      })
      streamRef.current = stream

      const ctx   = new (window.AudioContext || window.webkitAudioContext)()
      const src   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.6   // some temporal smoothing

      src.connect(analyser)
      // NOTE: do NOT connect to ctx.destination — that would create feedback

      audioCtxRef.current  = ctx
      analyserRef.current  = analyser
      freqBufRef.current   = new Uint8Array(analyser.frequencyBinCount)

      setMicEnabled(true)

      // Resume context if browser auto-suspended it
      if (ctx.state === 'suspended') await ctx.resume()

      pollRef.current = setInterval(() => {
        if (!analyserRef.current || !freqBufRef.current) return

        analyserRef.current.getByteFrequencyData(freqBufRef.current)
        const rms = calculateRMS(freqBufRef.current)
        const level = Math.min(100, Math.round(rms))
        setAudioLevel(level)

        const now = Date.now()

        // ── Voice / sustained speech check ────────────────────────────────
        if (rms >= VOICE_THRESHOLD) {
          aboveVoiceAt.current ??= now
          aboveWhisperAt.current = null
          isWhispering && setIsWhispering(false)
          whisperingRef.current = false

          if (now - aboveVoiceAt.current >= SUSTAIN_DURATION && !speakingRef.current) {
            speakingRef.current = true
            setIsSpeaking(true)
            onSpeakingRef.current?.('voice')
          }
        } else if (rms >= WHISPER_THRESHOLD) {
          aboveVoiceAt.current = null
          aboveWhisperAt.current ??= now

          if (speakingRef.current) {
            speakingRef.current = false
            setIsSpeaking(false)
          }

          if (now - aboveWhisperAt.current >= SUSTAIN_DURATION && !whisperingRef.current) {
            whisperingRef.current = true
            setIsWhispering(true)
            onWhisperRef.current?.('whisper')
          }
        } else {
          // Below both thresholds
          if (aboveVoiceAt.current || aboveWhisperAt.current) {
            aboveVoiceAt.current  = null
            aboveWhisperAt.current = null
          }
          if (speakingRef.current) {
            speakingRef.current = false
            setIsSpeaking(false)
          }
          if (whisperingRef.current) {
            whisperingRef.current = false
            setIsWhispering(false)
          }
        }
      }, POLL_INTERVAL)

    } catch (err) {
      console.warn('[useAudioMonitor] Mic access denied or error:', err)
      setMicEnabled(false)
    }
  }, [])

  return {
    audioLevel,
    isSpeaking,
    isWhispering,
    micEnabled,
    startAudio,
    stopAudio,
    setOnSpeaking,
    setOnWhisper,
  }
}
