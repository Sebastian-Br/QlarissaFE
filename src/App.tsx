import { BrowserRouter, Routes, Route } from "react-router-dom"
import './App.css'
import UserLogin from './components/UserLogin'
import UserRegistration from './components/UserRegistration'
import Dashboard from './components/Dashboard'
import SecurityDetail from './components/SecurityDetail'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserLogin/>} />
        <Route path="/login" element={<UserLogin/>} />
        <Route path="/register" element={<UserRegistration/>} />
        <Route path="/dashboard" element={<Dashboard/>} />
        <Route path="/security/:id" element={<SecurityDetail/>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
