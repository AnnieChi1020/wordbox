import { localEnv } from "../support/local-supabase"

export default function globalSetup() {
  process.env.E2E_SUPABASE_ENV = JSON.stringify(localEnv())
}
