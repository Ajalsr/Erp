import { Route, Routes } from "react-router"
import Login from "./Components/Login/Login"
import Home from "./Components/Home/Home"



function App() {
  

  return (
    <>
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route path="/Home" element={<Home/>} />
      </Routes>
    </>
  )
}

export default App
