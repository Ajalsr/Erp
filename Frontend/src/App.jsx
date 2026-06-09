import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { Toaster } from "react-hot-toast";

// Eager: app shell + auth landing. These paint first, so no lazy/Suspense flash.
import Login from "./Components/Login/Login"
import Layout from "./Components/Layout"
import ProtectedRoute from "./Components/ProtectedRoute/ProtectedRoute"
import ErrorBoundary from "./Components/ErrorBoundary/ErrorBoundary"

// Lazy: every screen below is code-split into its own chunk and only fetched when
// its route is first visited. Keeps the initial bundle small → faster first load.
const Home = lazy(() => import("./Components/Home/Home"))
const Signup = lazy(() => import("./Components/Signup/Signup"))
const Item = lazy(() => import("./Components/Item/Item"))
const New = lazy(() => import("./Components/NewItem/New"))
const Customers = lazy(() => import("./Components/Customers/Customers"))
const Newcustomers = lazy(() => import("./Components/NewCustomers/Newcustomers"))
const Salesorders = lazy(() => import("./Components/SalesOrders/Salesorders"))
const Newsalesorders = lazy(() => import("./Components/NewSalesOrders/Newsalesorders"))
const Purchaseorders = lazy(() => import("./Components/PurchaseOrders/Purchaseorders"))
const Newpurchaseorders = lazy(() => import("./Components/NewPurchaseOrders/Newpurchaseorders"))
const Outbound = lazy(() => import("./Components/Outbound/Outbound"))
const DeliveryNote = lazy(() => import("./Components/DeliveryNote/Deliverynote"))
const DeliveryNoteList = lazy(() => import("./Components/DeliveryNote/DeliveryNoteList"))
const Vendors = lazy(() => import("./Components/Vendor/Vendor"))
const NewVendor = lazy(() => import("./Components/NewVendor/NewVendor"))
const GRN = lazy(() => import("./Components/Purchase/GRN"))
const GRNList = lazy(() => import("./Components/Purchase/GRNList"))
const Inbound = lazy(() => import("./Components/Purchase/Inbound"))
const ReorderAlerts = lazy(() => import("./Components/Inventory/ReorderAlerts"))
const BatchExpiry = lazy(() => import("./Components/Inventory/BatchExpiry"))
const CreateOrganization = lazy(() => import("./Components/Organization/CreateOrganization"))
const OrganizationSettings = lazy(() => import("./Components/Organization/OrganizationSettings"))
const AcceptInvitation = lazy(() => import("./Components/Organization/AcceptInvitation"))
const Invoices = lazy(() => import("./Components/Invoices/Invoices"))
const InvoicePrint = lazy(() => import("./Components/Invoices/InvoicePrint"))
const Createinvoices = lazy(() => import("./Components/Createinvoices/Createinvoices"))
const RecurringInvoices = lazy(() => import("./Components/RecurringInvoices/RecurringInvoices"))
const PaymentsReceived = lazy(() => import("./Components/PaymentsReceived/PaymentsReceived"))
const AdvancePayments = lazy(() => import("./Components/AdvancePayments/AdvancePayments"))
const Bills = lazy(() => import("./Components/Bills/Bills"))
const NewBill = lazy(() => import("./Components/Bills/NewBill"))
const PaymentsMade = lazy(() => import("./Components/PaymentsMade/PaymentsMade"))
const VendorCredits = lazy(() => import("./Components/VendorCredits/VendorCredits"))
const SalesReport = lazy(() => import("./Components/Reports/SalesReport"))
const PurchaseReport = lazy(() => import("./Components/Reports/PurchaseReport"))
const InventoryReport = lazy(() => import("./Components/Reports/InventoryReport"))
const AgingReport = lazy(() => import("./Components/Reports/AgingReport"))
const CustomerStatement = lazy(() => import("./Components/Reports/CustomerStatement"))
const StatementOfAccount = lazy(() => import("./Components/Reports/StatementOfAccount"))
const VATReport = lazy(() => import("./Components/Reports/VATReport"))
const VendorAging = lazy(() => import("./Components/Reports/VendorAging"))
const TrialBalance = lazy(() => import("./Components/Reports/TrialBalance"))
const ProfitLoss = lazy(() => import("./Components/Reports/ProfitLoss"))
const BalanceSheet = lazy(() => import("./Components/Reports/BalanceSheet"))
const CashFlow = lazy(() => import("./Components/Reports/CashFlow"))
const Accounts = lazy(() => import("./Components/Accounts/Accounts"))
const NewAccount = lazy(() => import("./Components/NewAccount/NewAccount"))
const JournalEntries = lazy(() => import("./Components/Finance/JournalEntries"))
const BankReconciliation = lazy(() => import("./Components/Finance/BankReconciliation"))
const ExchangeRates = lazy(() => import("./Components/Finance/ExchangeRates"))
const ItemGroups = lazy(() => import("./Components/ItemGroups/ItemGroups"))
const PriceLists = lazy(() => import("./Components/PriceLists/PriceLists"))
const NewPriceList = lazy(() => import("./Components/NewPriceList/NewPriceList"))
const StockSummary = lazy(() => import("./Components/Inventory/StockSummary"))
const Warehouses = lazy(() => import("./Components/Inventory/Warehouses"))
const Adjustments = lazy(() => import("./Components/Inventory/Adjustments"))
const Enquiries = lazy(() => import("./Components/Enquiries/Enquiries"))
const CreditNotes = lazy(() => import("./Components/CreditNotes/CreditNotes"))
const PublicInvoice = lazy(() => import("./Components/Invoices/PublicInvoice"))
const Quotes = lazy(() => import("./Components/Quotes/Quotes"))
const CreateQuote = lazy(() => import("./Components/Quotes/CreateQuote"))
const QuotePrint = lazy(() => import("./Components/Quotes/QuotePrint"))

// Lightweight fallback shown while a route chunk loads.
const RouteFallback = () => (
  <div style={{
    display: 'flex', height: '100%', minHeight: '60vh',
    alignItems: 'center', justifyContent: 'center',
    color: '#64748b', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
  }}>
    Loading…
  </div>
)

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
        <Suspense fallback={<RouteFallback />}>
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
              <Route path="/Sales/RecurringInvoices" element={<RecurringInvoices />} />
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
              <Route path="/Reports/profit-loss"          element={<ProfitLoss />} />
              <Route path="/Reports/balance-sheet"        element={<BalanceSheet />} />
              <Route path="/Reports/cash-flow"            element={<CashFlow />} />
              <Route path="/Reports/vendor-aging"         element={<VendorAging />} />
              <Route path="/Finance/Accounts"        element={<Accounts />} />
              <Route path="/Finance/Accounts/New"    element={<NewAccount />} />
              <Route path="/Finance/JournalEntries"  element={<JournalEntries />} />
              <Route path="/Finance/BankReconciliation" element={<BankReconciliation />} />
              <Route path="/Finance/ExchangeRates" element={<ExchangeRates />} />
              <Route path="/Items/item-groups"        element={<ItemGroups />} />
              <Route path="/Items/price-lists"        element={<PriceLists />} />
              <Route path="/Items/price-lists/new"    element={<NewPriceList />} />
              <Route path="/Inventory/stock-summary"  element={<StockSummary />} />
              <Route path="/Inventory/warehouses"     element={<Warehouses />} />
              <Route path="/Inventory/adjustments"    element={<Adjustments />} />
              <Route path="/Sales/CreditNotes"        element={<CreditNotes />} />
              <Route path="/Sales/Quotes"             element={<Quotes />} />
              <Route path="/Sales/Quotes/new"         element={<CreateQuote />} />
              <Route path="/Sales/Quotes/:id/print"   element={<QuotePrint />} />
              <Route path="/Sales/Quotes/:id"         element={<CreateQuote />} />
            </Route>

            {/* Public invoice — no layout, no auth */}
            <Route path="/invoice/public/:token" element={<PublicInvoice />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  )

}

export default App
