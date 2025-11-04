import { Route, Routes } from "react-router-dom"
import Login from "./Components/Login/Login"
import Home from "./Components/Home/Home"
import Signup from "./Components/Signup/Signup"
import Layout from "./Components/Layout"
import Item from "./Components/Item/Item"
import New from "./Components/NewItem/New"
import  { Toaster } from "react-hot-toast";


function App() {
  

  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route path="/Signup" element={<Signup/>}/>
        <Route element={<Layout/>}>
          <Route path="/Home" element={<Home />} />
          <Route path="/Items/Items" element={<Item/>} />
          <Route path="/Items/Items/New" element={<New/>} />
        </Route>
      </Routes>
    </>
  )
}

export default App
