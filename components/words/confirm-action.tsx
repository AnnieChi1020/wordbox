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
  /** 觸發按鈕的內容 */
  children: ReactNode
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  disabled?: boolean
  /** 確認後執行；結束後關閉對話框 */
  onConfirm: () => Promise<void>
}

/** 需要使用者確認的操作（R4.5、R4.7）。 */
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
