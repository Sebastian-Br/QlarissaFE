import { useEffect, useState } from "react"
import { Check, LoaderCircle, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import {
  checkEmailAvailability,
  checkUsernameAvailability,
  registerUser,
} from "@/api/accountApi"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const VALIDATION_DELAY_MS = 750

type FieldStatus = "idle" | "loading" | "available" | "unavailable" | "error"

function StatusIndicator({ status }: { status: FieldStatus }) {
  if (status === "idle") return null

  if (status === "loading") {
    return <LoaderCircle className="size-5 animate-spin text-blue-200" aria-label="Checking availability" />
  }

  const isAvailable = status === "available"
  const label = isAvailable ? "Available" : "Unavailable"

  return (
    <span
      className={`flex size-5 items-center justify-center rounded-full ${isAvailable ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
      role="img"
      aria-label={label}
    >
      {isAvailable ? <Check className="size-3.5" /> : <X className="size-3.5" />}
    </span>
  )
}

export default function UserRegistration() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [usernameStatus, setUsernameStatus] = useState<FieldStatus>("idle")
  const [emailStatus, setEmailStatus] = useState<FieldStatus>("idle")
  const [passwordStatus, setPasswordStatus] = useState<FieldStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    const value = username.trim()
    if (!value) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setUsernameStatus("loading")
      try {
        const { available } = await checkUsernameAvailability(value, controller.signal)
        setUsernameStatus(available ? "available" : "unavailable")
      } catch (error) {
        if ((error as Error).name !== "AbortError") setUsernameStatus("error")
      }
    }, VALIDATION_DELAY_MS)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [username])

  useEffect(() => {
    const value = email.trim()
    if (!value || !/^\S+@\S+\.\S+$/.test(value)) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setEmailStatus("loading")
      try {
        const { available } = await checkEmailAvailability(value, controller.signal)
        setEmailStatus(available ? "available" : "unavailable")
      } catch (error) {
        if ((error as Error).name !== "AbortError") setEmailStatus("error")
      }
    }, VALIDATION_DELAY_MS)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [email])

  useEffect(() => {
    if (!password) return

    const timeout = window.setTimeout(() => {
      const isValid = /[a-z]/.test(password)
        && /[A-Z]/.test(password)
        && /\d/.test(password)
        && /[^A-Za-z0-9]/.test(password)
      setPasswordStatus(isValid ? "available" : "unavailable")
    }, VALIDATION_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [password])

  async function handleRegister() {
    const res = await registerUser({ username, email, password })
    if (res.ok) {
      navigate("/login")
    } else {
      const errorText = await res.text()
      setError(errorText || "Registration failed")
    }
  }

  function updateUsername(value: string) {
    setUsername(value)
    setUsernameStatus("idle")
  }

  function updateEmail(value: string) {
    setEmail(value)
    setEmailStatus("idle")
  }

  function updatePassword(value: string) {
    setPassword(value)
    setPasswordStatus("idle")
  }

  return (
    <div className="flex min-h-screen items-center justify-center rounded-xl p-4">
      <Card className="relative w-full max-w-md shadow-xl">
        <Button
          variant="link"
          className="absolute top-2 right-2 h-auto p-0 text-blue-300 hover:text-blue-400 hover:no-underline"
          onClick={() => navigate("/login")}
        >
          <span className="text-sm">Already have an account?</span>
        </Button>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input id="username" value={username} onChange={event => updateUsername(event.target.value)} placeholder="your username" className="pr-10" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <StatusIndicator status={usernameStatus} />
              </span>
            </div>
            {usernameStatus === "unavailable" && <p className="text-sm text-red-300" role="alert">This username is already taken.</p>}
            {usernameStatus === "error" && <p className="text-sm text-red-300" role="alert">We could not check this username.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Input type="email" id="email" value={email} onChange={event => updateEmail(event.target.value)} placeholder="your email address" className="pr-10" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <StatusIndicator status={emailStatus} />
              </span>
            </div>
            {emailStatus === "unavailable" && <p className="text-sm text-red-300" role="alert">An account already uses this email address.</p>}
            {emailStatus === "error" && <p className="text-sm text-red-300" role="alert">We could not check this email address.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Input type="password" id="password" value={password} onChange={event => updatePassword(event.target.value)} placeholder="your password" className="pr-10" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <StatusIndicator status={passwordStatus} />
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="opacity-90">
                <span className="text-sm">Use uppercase and lowercase letters, a number, and a symbol.</span>
              </TooltipContent>
            </Tooltip>
            {passwordStatus === "unavailable" && <p className="text-sm text-red-300" role="alert">Use uppercase and lowercase letters, a number, and a symbol.</p>}
          </div>

          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

          <Button className="w-full" onClick={handleRegister}>
            Register
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
