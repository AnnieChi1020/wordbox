import { redirect } from "next/navigation"

// proxy.ts 會先依登入狀態導向；這裡只是保險
export default function Home() {
  redirect("/words")
}
