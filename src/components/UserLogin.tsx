import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function UserRegistration() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 rounded-xl">
      <Card className="w-1/4 shadow-xl">
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
            <Input
              type="password"
              id="password"
              placeholder="your password"
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