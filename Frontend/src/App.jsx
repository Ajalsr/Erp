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
import DeliveryNoteList from "./Components/DeliveryNote/DeliveryNoteList"
import ProtectedRoute from "./Components/ProtectedRoute/ProtectedRoute"
import Vendors from "./Components/Vendor/Vendor"
import NewVendor from "./Components/NewVendor/NewVendor"
import GRN from "./Components/Purchase/GRN"
import GRNList from "./Components/Purchase/GRNList"
import Inbound from "./Components/Purchase/Inbound"
import ReorderAlerts from "./Components/Inventory/ReorderAlerts"
import BatchExpiry from "./Components/Inventory/BatchExpiry"
import CreateOrganization from "./Components/Organization/CreateOrganization"
import OrganizationSettings from "./Components/Organization/OrganizationSettings"
import AcceptInvitation from "./Components/Organization/AcceptInvitation"
import Invoices from "./Components/Invoices/Invoices"
import InvoicePrint from "./Components/Invoices/InvoicePrint"
import Createinvoices from "./Components/Createinvoices/Createinvoices"
import PaymentsReceived from "./Components/PaymentsReceived/PaymentsReceived"
import AdvancePayments from "./Components/AdvancePayments/AdvancePayments"
import Bills from "./Components/Bills/Bills"
import NewBill from "./Components/Bills/NewBill"
import PaymentsMade from "./Components/PaymentsMade/PaymentsMade"
import VendorCredits from "./Components/VendorCredits/VendorCredits"
import SalesReport from "./Components/Reports/SalesReport"
import PurchaseReport from "./Components/Reports/PurchaseReport"
import InventoryReport from "./Components/Reports/InventoryReport"
import AgingReport from "./Components/Reports/AgingReport"
import CustomerStatement from "./Components/Reports/CustomerStatement"
import StatementOfAccount from "./Components/Reports/StatementOfAccount"
import VATReport from "./Components/Reports/VATReport"
import VendorAging from "./Components/Reports/VendorAging"
import TrialBalance from "./Components/Reports/TrialBalance"
import Accounts from "./Components/Accounts/Accounts"
import NewAccount from "./Components/NewAccount/NewAccount"
import ItemGroups from "./Components/ItemGroups/ItemGroups"
import PriceLists from "./Components/PriceLists/PriceLists"
import NewPriceList from "./Components/NewPriceList/NewPriceList"
import StockSummary from "./Components/Inventory/StockSummary"
import Warehouses from "./Components/Inventory/Warehouses"
import Adjustments from "./Components/Inventory/Adjustments"
import Enquiries from "./Components/Enquiries/Enquiries"
import CreditNotes from "./Components/CreditNotes/CreditNotes"
import PublicInvoice from "./Components/Invoices/PublicInvoice"
import Quotes from "./Components/Quotes/Quotes"
import CreateQuote from "./Components/Quotes/CreateQuote"
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
        containerStyle={{ top: 68, right: 20 }}
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
            <Route path="/Sales/Customers/edit/:id" element={<Newcustomers />} />
            <Route path="/sales/customers/edit/:id" element={<Newcustomers />} />
            <Route path="/Sales/Enquiries" element={<Enquiries />} />
            <Route path="/Sales/Salesorders" element={<Salesorders />} />
            <Route path="/Sales/Outbound" element={<Outbound />} />
            <Route path="/Sales/Deliverynote" element={<DeliveryNoteList />} />
            <Route path="/Sales/Deliverynote/:id" element={<DeliveryNote />} />
            <Route path="/Sales/Salesorders/Newsalesorders" element={<Newsalesorders />} />
            <Route path="/Sales/Salesorders/Newsalesorders/:id" element={<Newsalesorders />} />
            <Route path="/Purchase/Purchaseorders" element={<Purchaseorders />} />
            <Route path="/Purchase/Purchaseorders/Newpurchaseorders" element={<Newpurchaseorders />} />
            <Route path="/Purchase/Vendors" element={<Vendors />} />
            <Route path="/Purchase/Vendors/NewVendor" element={<NewVendor />} />
            <Route path="/Purchase/Vendors/Edit/:id" element={<NewVendor />} />
            <Route path="/Purchase/GRN" element={<GRNList />} />
            <Route path="/Purchase/GRN/new" element={<GRN />} />
            <Route path="/Purchase/GRN/:id" element={<GRN />} />
            <Route path="/Purchase/Inbound" element={<Inbound />} />
            <Route path="/Inventory/reorder-alerts" element={<ReorderAlerts />} />
            <Route path="/Inventory/batch-expiry"   element={<BatchExpiry />} />
            <Route path="/organizations/:id/settings" element={<OrganizationSettings />} />
            <Route path="/Sales/Invoices" element={<Invoices />} />
            <Route path="/Sales/Invoices/:id/print" element={<InvoicePrint />} />
            <Route path="/Sales/Createinvoices" element={<Createinvoices />} />
            <Route path="/Sales/PaymentsReceived" element={<PaymentsReceived />} />
            <Route path="/Sales/AdvancePayments"   element={<AdvancePayments />} />
            <Route path="/Purchase/Bills" element={<Bills />} />
            <Route path="/Purchase/Bills/New" element={<NewBill />} />
            <Route path="/Purchase/Bills/Edit/:id" element={<NewBill />} />
            <Route path="/Purchase/PaymentsMade" element={<PaymentsMade />} />
            <Route path="/Purchase/VendorCredits" element={<VendorCredits />} />
            <Route path="/Reports/sales"                element={<SalesReport />} />
            <Route path="/Reports/purchases"            element={<PurchaseReport />} />
            <Route path="/Reports/inventory"            element={<InventoryReport />} />
            <Route path="/Reports/aging"                element={<AgingReport />} />
            <Route path="/Reports/customer-statement"   element={<CustomerStatement />} />
            <Route path="/Reports/statement-of-account" element={<StatementOfAccount />} />
            <Route path="/Reports/vat"                  element={<VATReport />} />
            <Route path="/Reports/trial-balance"        element={<TrialBalance />} />
            <Route path="/Reports/vendor-aging"         element={<VendorAging />} />
            <Route path="/Finance/Accounts"        element={<Accounts />} />
            <Route path="/Finance/Accounts/New"    element={<NewAccount />} />
            <Route path="/Items/item-groups"        element={<ItemGroups />} />
            <Route path="/Items/price-lists"        element={<PriceLists />} />
            <Route path="/Items/price-lists/new"    element={<NewPriceList />} />
            <Route path="/Inventory/stock-summary"  element={<StockSummary />} />
            <Route path="/Inventory/warehouses"     element={<Warehouses />} />
            <Route path="/Inventory/adjustments"    element={<Adjustments />} />
            <Route path="/Sales/CreditNotes"        element={<CreditNotes />} />
            <Route path="/Sales/Quotes"             element={<Quotes />} />
            <Route path="/Sales/Quotes/new"         element={<CreateQuote />} />
            <Route path="/Sales/Quotes/:id"         element={<CreateQuote />} />
          </Route>

          {/* Public invoice — no layout, no auth */}
          <Route path="/invoice/public/:token" element={<PublicInvoice />} />
        </Routes>
      </ErrorBoundary>
    </>
  )
  
}

export default App
