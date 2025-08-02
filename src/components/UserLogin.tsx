import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

import { useNavigate } from "react-router-dom"

export default function UserRegistration() {
  let navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen p-4 rounded-xl">
      <Card className="w-1/4 relative shadow-xl">
          <Button variant="link" className="absolute top-2 right-2 text-blue-300 hover:text-blue-400 p-0 h-auto hover:no-underline" onClick={() => navigate("/register")}>
            <a className="text-sm">Don&apos;t have an account?</a>
          </Button>
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
            <Label htmlFor="password">
            Password
            </Label>
            <Input type="password" id="password" placeholder="your password"
            />
          </div>
          <Button className="w-full" onClick={() => alert('Button clicked!')}>
            Login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}