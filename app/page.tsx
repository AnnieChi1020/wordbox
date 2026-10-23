import { redirect } from "next/navigation"

// proxy.ts redirects by sign-in state first; this is just a fallback
export default function Home() {
  redirect("/words")
}
