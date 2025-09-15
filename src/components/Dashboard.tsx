import { useNavigate } from "react-router-dom"
import { GetSecret } from "@/api/dashboardApi"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function UserDashboard() {
  let navigate = useNavigate()

  async function handleSecretTest(){
    const response = await GetSecret()
    if (response.ok) {
      const data = await response.json();
      alert("Response: " + JSON.stringify(data))
    } else {
      alert("Error: " + response.statusText)
  }
  }

  return (
    <div>
      <p>Dashboard</p>
        <Button color="e2e8f0" onClick={handleSecretTest}>
            Test Secret
          </Button>
    </div>
  )
}