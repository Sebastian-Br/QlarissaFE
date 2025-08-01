import { useState } from 'react'
import { Button } from './components/ui/button'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import './App.css'
import UserLogin from './components/UserLogin'
import UserRegistration from './components/UserRegistration'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        {/* Default route */}
        <Route path="/" element={<UserLogin />} />

        {/* Explicit login route (optional) */}
        <Route path="/login" element={<UserLogin />} />

        {/* Registration route */}
        <Route path="/register" element={<UserRegistration />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
