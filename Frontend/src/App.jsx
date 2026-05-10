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
import Outbound from "./Components/Outbound/Outbound"
import DeliveryNote from "./Components/DeliveryNote/Deliverynote"
import ProtectedRoute from "./Components/ProtectedRoute/ProtectedRoute"
import Vendors from "./Components/Vendor/Vendor"
import NewVendor from "./Components/NewVendor/NewVendor"
import GRN from "./Components/Purchase/GRN"
import Inbound from "./Components/Purchase/Inbound"
import PurchaseStock from "./Components/Purchase/Stock"
import CreateOrganization from "./Components/Organization/CreateOrganization"
import OrganizationSettings from "./Components/Organization/OrganizationSettings"
import AcceptInvitation from "./Components/Organization/AcceptInvitation"
import Invoices from "./Components/Invoices/Invoices"
import Createinvoices from "./Components/Createinvoices/Createinvoices"
import PaymentsReceived from "./Components/PaymentsReceived/PaymentsReceived"
import Bills from "./Components/Bills/Bills"
import NewBill from "./Components/Bills/NewBill"
import PaymentsMade from "./Components/PaymentsMade/PaymentsMade"
import VendorCredits from "./Components/VendorCredits/VendorCredits"
import SalesReport from "./Components/Reports/SalesReport"
import PurchaseReport from "./Components/Reports/PurchaseReport"
import InventoryReport from "./Components/Reports/InventoryReport"
import Accounts from "./Components/Accounts/Accounts"
import NewAccount from "./Components/NewAccount/NewAccount"
import ItemGroups from "./Components/ItemGroups/ItemGroups"
import PriceLists from "./Components/PriceLists/PriceLists"
import NewPriceList from "./Components/NewPriceList/NewPriceList"
import StockSummary from "./Components/Inventory/StockSummary"
import Warehouses from "./Components/Inventory/Warehouses"
import Adjustments from "./Components/Inventory/Adjustments"
import Enquiries from "./Components/Enquiries/Enquiries"
import ErrorBoundary from "./Components/ErrorBoundary/ErrorBoundary"

function App() {
  return (
    <>
      {/*
        IMPORTANT: style must be fully transparent here.
        nexusToast uses toast.custom() which renders its own complete UI.
        Any background/padding/shadow on the Toaster wrapper will paint
        over the custom component — making toasts invisible or miscoloured.
      */}
      <Toaster
        position="top-right"
        gutter={10}
        containerStyle={{ top: 20, right: 20 }}
        toastOptions={{
          style: {
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
            margin: 0,
          },
        }}
      />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/Signup" element={<Signup />} />

          {/* Invitation accept — accessible when logged in, before org is set */}
          <Route path="/invitations/accept" element={<AcceptInvitation />} />

          {/* Create first org after signup (protected, but outside main layout) */}
          <Route
            path="/organizations/create"
            element={<ProtectedRoute><CreateOrganization /></ProtectedRoute>}
          />

          {/* All protected routes inside main layout */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/Home" element={<Home />} />
            <Route path="/Items/Items" element={<Item />} />
            <Route path="/Items/Items/New" element={<New />} />
            <Route path="/Sales/Customers" element={<Customers />} />
            <Route path="/Sales/Customers/Newcustomers" element={<Newcustomers />} />
            <Route path="/Sales/Enquiries" element={<Enquiries />} />
            <Route path="/Sales/Salesorders" element={<Salesorders />} />
            <Route path="/Sales/Outbound" element={<Outbound />} />
            <Route path="/Sales/Deliverynote" element={<DeliveryNote />} />
            <Route path="/Sales/Salesorders/Newsalesorders" element={<Newsalesorders />} />
            <Route path="/Purchase/Purchaseorders" element={<Purchaseorders />} />
            <Route path="/Purchase/Purchaseorders/Newpurchaseorders" element={<Newpurchaseorders />} />
            {/* FIXED: Was missing leading "/" — navigation silently 404'd */}
            <Route path="/Purchase/Vendors" element={<Vendors />} />
            <Route path="/Purchase/Vendors/NewVendor" element={<NewVendor />} />
            <Route path="/Purchase/GRN" element={<GRN />} />
            <Route path="/Purchase/Inbound" element={<Inbound />} />
            <Route path="/Purchase/Stock" element={<PurchaseStock />} />
            {/* Organization settings & members */}
            <Route path="/organizations/:id/settings" element={<OrganizationSettings />} />
            <Route path="/Sales/Invoices" element={<Invoices />} />
            <Route path="/Sales/Createinvoices" element={<Createinvoices />} />
            <Route path="/Sales/PaymentsReceived" element={<PaymentsReceived />} />
            <Route path="/Purchase/Bills" element={<Bills />} />
            <Route path="/Purchase/Bills/New" element={<NewBill />} />
            <Route path="/Purchase/PaymentsMade" element={<PaymentsMade />} />
            <Route path="/Purchase/VendorCredits" element={<VendorCredits />} />
            <Route path="/Reports/sales"     element={<SalesReport />} />
            <Route path="/Reports/purchases" element={<PurchaseReport />} />
            <Route path="/Reports/inventory" element={<InventoryReport />} />
            <Route path="/Finance/Accounts"        element={<Accounts />} />
            <Route path="/Finance/Accounts/New"    element={<NewAccount />} />
            <Route path="/Items/item-groups"        element={<ItemGroups />} />
            <Route path="/Items/price-lists"        element={<PriceLists />} />
            <Route path="/Items/price-lists/new"    element={<NewPriceList />} />
            <Route path="/Inventory/stock-summary"  element={<StockSummary />} />
            <Route path="/Inventory/warehouses"     element={<Warehouses />} />
            <Route path="/Inventory/adjustments"    element={<Adjustments />} />
            {/* NOTE: /Sales/CreditNotes removed from sidebar until component is built */}
          </Route>
        </Routes>
      </ErrorBoundary>
    </>
  )
}

export default App
