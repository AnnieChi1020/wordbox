"use client"

import { Loader2, Plus, Trash2 } from "lucide-react"
import { useId, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateWord } from "@/lib/actions/words"
import type { WordDetail } from "@/lib/db/words"
import { POS_ABBR, POS_VALUES, type PartOfSpeech } from "@/lib/domain/pos"
import {
  EditWordSchema,
  fieldErrors,
  splitLines,
  splitList,
  type EditWordInput,
} from "@/lib/words/editSchema"

const MAX_SENSES = 3

type FormSense = {
  /** React key；新增的義項沒有 id */
  key: string
  id?: string
  pos: PartOfSpeech
  def_en: string
  def_zh: string
  synonyms: string
  antonyms: string
  examples: string
}

function toForm(word: WordDetail): { ipa: string; senses: FormSense[] } {
  return {
    ipa: word.ipa ?? "",
    senses: word.senses.map((s) => ({
      key: s.id,
      id: s.id,
      pos: s.pos,
      def_en: s.def_en,
      def_zh: s.def_zh,
      synonyms: s.synonyms.join(", "),
      antonyms: s.antonyms.join(", "),
      examples: s.examples.join("\n"),
    })),
  }
}

function toInput(ipa: string, senses: FormSense[]): EditWordInput {
  return {
    ipa,
    senses: senses.map((s) => ({
      ...(s.id ? { id: s.id } : {}),
      pos: s.pos,
      def_en: s.def_en,
      def_zh: s.def_zh,
      synonyms: splitList(s.synonyms),
      antonyms: splitList(s.antonyms),
      examples: splitLines(s.examples),
    })),
  }
}

/** R4.3、R4.4：編輯 IPA 與義項；單字本身不可修改。 */
export function WordEditForm({
  word,
  onCancel,
  onSaved,
}: {
  word: WordDetail
  onCancel: () => void
  onSaved: () => void
}) {
  const baseId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [initial] = useState(() => toForm(word))
  const [ipa, setIpa] = useState(initial.ipa)
  const [senses, setSenses] = useState(initial.senses)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, startSaving] = useTransition()

  const fieldId = (path: string) => `${baseId}-${path.replace(/\./g, "-")}`

  function update(index: number, patch: Partial<FormSense>) {
    setSenses((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    )
  }

  function showErrors(next: Record<string, string>) {
    setErrors(next)
    // 焦點移到第一個錯誤欄位
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid=true]")
        ?.focus()
    })
  }

  function submit() {
    const input = toInput(ipa, senses)
    const parsed = EditWordSchema.safeParse(input)
    if (!parsed.success) {
      showErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    startSaving(async () => {
      const result = await updateWord(word.id, input).catch(() => ({
        ok: false as const,
        message: "儲存失敗，請重試",
        fieldErrors: undefined,
      }))
      if (result.ok) {
        toast.success("已儲存")
        onSaved()
      } else {
        toast.error(result.message)
        if (result.fieldErrors) showErrors(result.fieldErrors)
      }
    })
  }

  /** 欄位的錯誤訊息與無障礙屬性 */
  function errorProps(path: string) {
    const error = errors[path]
    return {
      id: fieldId(path),
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${fieldId(path)}-error` : undefined,
    }
  }

  function errorText(path: string) {
    const error = errors[path]
    return error ? (
      <p id={`${fieldId(path)}-error`} className="text-destructive text-xs">
        {error}
      </p>
    ) : null
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-label={`編輯 ${word.text}`}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label htmlFor={fieldId("ipa")}>音標（IPA）</Label>
          <Input
            {...errorProps("ipa")}
            value={ipa}
            onChange={(e) => setIpa(e.target.value)}
            placeholder="/ˈæp.əl/"
          />
          {errorText("ipa")}
        </div>

        {senses.map((sense, i) => {
          const p = (field: string) => `senses.${i}.${field}`
          return (
            <fieldset
              key={sense.key}
              className="space-y-3 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <legend className="text-sm font-medium">義項 {i + 1}</legend>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={senses.length <= 1}
                  onClick={() =>
                    setSenses((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label={`移除義項 ${i + 1}`}
                >
                  <Trash2 aria-hidden />
                  移除
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor={fieldId(p("pos"))}>詞性</Label>
                  <select
                    {...errorProps(p("pos"))}
                    value={sense.pos}
                    onChange={(e) =>
                      update(i, { pos: e.target.value as PartOfSpeech })
                    }
                    className="border-input bg-background dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2 text-sm outline-none focus-visible:ring-3"
                  >
                    {POS_VALUES.map((pos) => (
                      <option key={pos} value={pos}>
                        {POS_ABBR[pos]} {pos}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={fieldId(p("def_zh"))}>中文解釋</Label>
                  <Input
                    {...errorProps(p("def_zh"))}
                    value={sense.def_zh}
                    onChange={(e) => update(i, { def_zh: e.target.value })}
                  />
                  {errorText(p("def_zh"))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={fieldId(p("def_en"))}>英文解釋</Label>
                <Textarea
                  {...errorProps(p("def_en"))}
                  value={sense.def_en}
                  onChange={(e) => update(i, { def_en: e.target.value })}
                  rows={2}
                />
                {errorText(p("def_en"))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={fieldId(p("synonyms"))}>
                    同義詞（逗號分隔，最多 5 個）
                  </Label>
                  <Input
                    {...errorProps(p("synonyms"))}
                    value={sense.synonyms}
                    onChange={(e) => update(i, { synonyms: e.target.value })}
                  />
                  {errorText(p("synonyms"))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={fieldId(p("antonyms"))}>
                    反義詞（逗號分隔，最多 5 個）
                  </Label>
                  <Input
                    {...errorProps(p("antonyms"))}
                    value={sense.antonyms}
                    onChange={(e) => update(i, { antonyms: e.target.value })}
                  />
                  {errorText(p("antonyms"))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={fieldId(p("examples"))}>
                  例句（每行一句，最多 2 句）
                </Label>
                <Textarea
                  {...errorProps(p("examples"))}
                  value={sense.examples}
                  onChange={(e) => update(i, { examples: e.target.value })}
                  rows={2}
                />
                {errorText(p("examples"))}
              </div>
            </fieldset>
          )
        })}

        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={senses.length >= MAX_SENSES}
            onClick={() =>
              setSenses((prev) => [
                ...prev,
                {
                  key: crypto.randomUUID(),
                  pos: prev.at(-1)?.pos ?? "noun",
                  def_en: "",
                  def_zh: "",
                  synonyms: "",
                  antonyms: "",
                  examples: "",
                },
              ])
            }
          >
            <Plus aria-hidden />
            新增義項
          </Button>
          {errors.senses && (
            <p role="alert" className="text-destructive text-xs">
              {errors.senses}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          取消
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 aria-hidden className="animate-spin" />}
          儲存
        </Button>
      </div>
    </form>
  )
}
