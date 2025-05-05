import { Route, Routes } from "react-router"
import Login from "./Components/Login/Login"
import Home from "./Components/Home/Home"
import Signup from "./Components/Signup/Signup"



function App() {
  

  return (
    <>
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route path="/Home" element={<Home/>} />
        <Route path="/Signup" element={<Signup/>}/>
      </Routes>
    </>
  )
}

export default App
