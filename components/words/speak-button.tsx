"use client"

import { Volume2 } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"

const noopSubscribe = () => () => {}

function useSpeechSupported() {
  return useSyncExternalStore(
    noopSubscribe,
    () => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    () => false, // 伺服器端不渲染，避免 hydration 不一致
  )
}

/** R4.2：以瀏覽器語音合成（en-US）朗讀；不支援時不顯示。 */
export function SpeakButton({ text }: { text: string }) {
  const supported = useSpeechSupported()
  if (!supported) return null

  function speak() {
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    const voice = synth.getVoices().find((v) => v.lang === "en-US")
    if (voice) utterance.voice = voice
    synth.speak(utterance)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={speak}
      aria-label={`朗讀 ${text}`}
    >
      <Volume2 aria-hidden />
    </Button>
  )
}
