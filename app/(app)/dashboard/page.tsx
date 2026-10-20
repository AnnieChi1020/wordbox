import type { Metadata } from "next"

export const metadata: Metadata = { title: "統計 | Wordbox" }

export default function DashboardPage() {
  return (
    <main className="flex-1 p-4">
      <h1 className="text-xl font-semibold">統計</h1>
      <p className="text-muted-foreground mt-2">即將推出</p>
    </main>
  )
}
