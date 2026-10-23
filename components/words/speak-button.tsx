"use client"

import { Volume2 } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"

const noopSubscribe = () => () => {}

function useSpeechSupported() {
  return useSyncExternalStore(
    noopSubscribe,
    () => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    () => false, // not rendered on the server, to avoid a hydration mismatch
  )
}

/** R4.2: reads the word aloud with the browser's speech synthesis (en-US); hidden when unsupported. */
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
