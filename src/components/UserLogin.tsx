import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { loginAsUser } from "@/api/accountApi"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function UserRegistration() {
  const navigate = useNavigate()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
      const res = await loginAsUser({ username, password })
      if (res.ok) {
        const token = await res.text();
        localStorage.setItem("jwt", token);
        navigate("/dashboard")
      } else {
        const errorText = await res.text()
        setError(errorText || "Login failed")
      }
    }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#02182c] px-5 py-10 text-slate-100 sm:px-8">
      <Card className="relative w-full max-w-md border-sky-200/15 bg-gradient-to-br from-slate-900/90 to-[#08243d] py-8 shadow-2xl shadow-slate-950/40 backdrop-blur-sm">
        <Button
          variant="link"
          className="absolute right-6 top-6 h-auto p-0 text-sm font-medium text-sky-300 hover:text-sky-200 hover:no-underline"
          onClick={() => navigate("/register")}
        >
          Create account
        </Button>
        <CardContent className="space-y-7 px-6 sm:px-8">
          <div className="space-y-3 pr-28">
            <p className="text-sm font-bold tracking-tight text-white">Qlarissa<span className="text-sky-400">.</span></p>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
              <p className="mt-1 text-sm text-slate-400">Sign in to continue to your financial workspace.</p>
            </div>
          </div>
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">Username</Label>
              <Input id="username" placeholder="your username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} className="h-11 border-sky-200/15 !bg-[#061d32]/70 text-slate-100 placeholder:text-slate-500 focus-visible:border-sky-400" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input type="password" id="password" placeholder="your password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="h-11 border-sky-200/15 !bg-[#061d32]/70 text-slate-100 placeholder:text-slate-500 focus-visible:border-sky-400" />
            </div>
            {error && <p className="rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-200" role="alert">{error}</p>}
            <Button type="submit" className="h-11 w-full bg-sky-400 font-semibold text-slate-950 hover:bg-sky-300">Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
