import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function UserRegistration() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 rounded-xl">
      <Card className="w-1/2 shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">
            Account Registration
          </CardTitle>
        </CardHeader>
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
              placeholder="pick a password with lower and upper case characters, numbers, and symbols"
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