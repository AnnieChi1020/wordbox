"use client"

import { Loader2 } from "lucide-react"
import { useState, useTransition, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type Props = {
  /** Content of the trigger button */
  children: ReactNode
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  disabled?: boolean
  /** Runs after confirming; the dialog closes when it finishes */
  onConfirm: () => Promise<void>
}

/** An action that needs the user's confirmation (R4.5, R4.7). */
export function ConfirmAction({
  children,
  title,
  description,
  confirmLabel,
  destructive,
  disabled,
  onConfirm,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <>
      <Button
        type="button"
        variant={destructive ? "ghost" : "outline"}
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={
          destructive ? "text-destructive hover:text-destructive" : undefined
        }
      >
        {children}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm()
                  setOpen(false)
                })
              }
            >
              {pending && <Loader2 aria-hidden className="animate-spin" />}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
