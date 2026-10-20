import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions/auth"

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        登出
      </Button>
    </form>
  )
}
