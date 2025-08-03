import { BrowserRouter, Routes, Route } from "react-router-dom"
import './App.css'
import UserLogin from './components/UserLogin'
import UserRegistration from './components/UserRegistration'
import Dashboard from './components/Dashboard'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserLogin/>} />
        <Route path="/login" element={<UserLogin/>} />
        <Route path="/register" element={<UserRegistration/>} />
        <Route path="/dashboard" element={<Dashboard/>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
