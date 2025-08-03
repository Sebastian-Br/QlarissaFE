import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { registerUser } from "@/api/accountApi"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function UserRegistration() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()

  async function handleRegister() {
    const res = await registerUser({ username, email, password })
    if (res.ok) {
      navigate("/login")
    } else {
      const errorText = await res.text()
      setError(errorText || "Registration failed")
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 rounded-xl">
      <Card className="w-1/4 shadow-xl relative">
        <Button
          variant="link" className="absolute top-2 right-2 text-blue-300 hover:text-blue-400 p-0 h-auto hover:no-underline" onClick={() => navigate("/login")}>
          <a className="text-sm">Already have an account?</a>
        </Button>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="your username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your email address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Tooltip>
              <TooltipTrigger>
                <Input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="your password"/>
              </TooltipTrigger>
              <TooltipContent className="opacity-90">
                <a className="text-sm">Your password must contain lower & upper case characters, numbers, and symbols</a>
              </TooltipContent>
            </Tooltip>
            
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button className="w-full" onClick={handleRegister}>
            Register
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
