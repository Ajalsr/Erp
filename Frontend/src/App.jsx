import { Route, Routes } from "react-router-dom"
import Login from "./Components/Login/Login"
import Home from "./Components/Home/Home"
import Signup from "./Components/Signup/Signup"
import Layout from "./Components/Layout"
import Item from "./Components/Item/Item"
import New from "./Components/NewItem/New"
import { Toaster } from "react-hot-toast";
import Customers from "./Components/Customers/Customers"
import Newcustomers from "./Components/NewCustomers/Newcustomers"
import Salesorders from "./Components/SalesOrders/Salesorders"
import Newsalesorders from "./Components/NewSalesOrders/Newsalesorders"
import Purchaseorders from "./Components/PurchaseOrders/Purchaseorders"
import Newpurchaseorders from "./Components/NewPurchaseOrders/Newpurchaseorders"
import EditCustomer from "./Components/Customers/EditCustomer"
import Outbound from "./Components/Outbound/Outbound"
import DeliveryNote from "./Components/DeliveryNote/Deliverynote"
import ProtectedRoute from "./Components/ProtectedRoute/ProtectedRoute" 
import Vendors from "./Components/Vendor/Vendor"

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#363636', color: '#fff' },
          success: { duration: 3000, style: { background: '#10B981' } },
          error: { duration: 4000, style: { background: '#EF4444' } },
        }}
      />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/Signup" element={<Signup />} />

        {/* 👇 All protected routes are now wrapped */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/Home" element={<Home />} />
          <Route path="/Items/Items" element={<Item />} />
          <Route path="/Items/Items/New" element={<New />} />
          <Route path="/Sales/Customers" element={<Customers />} />
          <Route path="/Sales/Customers/Newcustomers" element={<Newcustomers />} />
          <Route path="/sales/customers/edit/:id" element={<EditCustomer />} />
          <Route path="/Sales/Salesorders" element={<Salesorders />} />
          <Route path="/Sales/Outbound" element={<Outbound />} />
          <Route path="/Sales/Deliverynote" element={<DeliveryNote />} />
          <Route path="/Sales/Salesorders/Newsalesorders" element={<Newsalesorders />} />
          <Route path="/Purchase/Purchaseorders" element={<Purchaseorders />} />
          <Route path="/Purchase/Purchaseorders/Newpurchaseorders" element={<Newpurchaseorders />} />
          <Route path="Purchase/Vendors" element={<Vendors />} />
        </Route>
      </Routes>
    </>
  )
}

export default App