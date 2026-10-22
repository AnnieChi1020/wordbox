"use client"

import { RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ReloadButton() {
  return (
    <Button size="lg" onClick={() => window.location.reload()}>
      <RotateCw aria-hidden />
      重新整理
    </Button>
  )
}
