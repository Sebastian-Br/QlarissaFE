import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

export default function UserRegistration() {
  let navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen p-4 rounded-xl">
      <Card className="w-1/2 shadow-xl relative">
        <Button variant="link" className="absolute top-2 right-2 text-blue-300 hover:text-blue-400 p-0 h-auto hover:no-underline" onClick={() => navigate("/login")}>
          <a className="text-sm">Already have an account?</a>
        </Button>
        <CardTitle className="text-2xl font-bold">
          Account Registration
        </CardTitle>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">
              Username
            </Label>
            <Input
              id="username"
              placeholder="your username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">
              Email
            </Label>
            <Input
              type="email"
              id="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">
              Password
            </Label>
            <Input
              type="password"
              id="password"
              placeholder="use lower & upper case characters, numbers, and symbols"
            />
          </div>
          <Button className="w-full" onClick={() => alert('Button clicked!')}>
            Register
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}