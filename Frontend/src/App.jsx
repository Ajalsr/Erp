import { lazy, Suspense, useEffect } from "react"
import { Route, Routes, useNavigate } from "react-router-dom"
import { Toaster } from "react-hot-toast";
import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link"

// Eager: app shell + auth landing. These paint first, so no lazy/Suspense flash.
import Login from "./Components/Login/Login"
import Layout from "./Components/Layout"
import ProtectedRoute from "./Components/ProtectedRoute/ProtectedRoute"
import ErrorBoundary from "./Components/ErrorBoundary/ErrorBoundary"

// Lazy: every screen below is code-split into its own chunk and only fetched when
// its route is first visited. Keeps the initial bundle small → faster first load.
const Home = lazy(() => import("./Components/Home/Home"))
const Signup = lazy(() => import("./Components/Signup/Signup"))
const ForgotPassword = lazy(() => import("./Components/Login/ForgotPassword"))
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
const Profile = lazy(() => import("./Components/Profile/Profile"))
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
const Expenses = lazy(() => import("./Components/Expenses/Expenses"))
const NewExpense = lazy(() => import("./Components/Expenses/NewExpense"))
const Approvals = lazy(() => import("./Components/Approvals/Approvals"))
const TransactionExport = lazy(() => import("./Components/Export/TransactionExport"))
const Backups = lazy(() => import("./Components/Backups/Backups"))
const Letters = lazy(() => import("./Components/Letters/Letters"))
const Projects = lazy(() => import("./Components/Projects/Projects"))
const LetterPrint = lazy(() => import("./Components/Letters/LetterPrint"))
const LetterEditor = lazy(() => import("./Components/Letters/LetterEditor"))
const VendorCredits = lazy(() => import("./Components/VendorCredits/VendorCredits"))
const SalesReport = lazy(() => import("./Components/Reports/SalesReport"))
const SalesByEmirate = lazy(() => import("./Components/Reports/SalesByEmirate"))
const PurchaseReport = lazy(() => import("./Components/Reports/PurchaseReport"))
const InventoryReport = lazy(() => import("./Components/Reports/InventoryReport"))
const AgingReport = lazy(() => import("./Components/Reports/AgingReport"))
const CustomerStatement = lazy(() => import("./Components/Reports/CustomerStatement"))
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
const Employees = lazy(() => import("./Components/HR/Employees"))
const OrgChart = lazy(() => import("./Components/HR/OrgChart"))
const Payroll = lazy(() => import("./Components/HR/Payroll"))
const PayRunDetail = lazy(() => import("./Components/HR/PayRunDetail"))
const SalaryStructures = lazy(() => import("./Components/HR/SalaryStructures"))
const PayrollSchedules = lazy(() => import("./Components/HR/PayrollSchedules"))
const LeaveRequests = lazy(() => import("./Components/HR/LeaveRequests"))
const LeaveTypes = lazy(() => import("./Components/HR/LeaveTypes"))
const LeaveBalances = lazy(() => import("./Components/HR/LeaveBalances"))
const Enquiries = lazy(() => import("./Components/Enquiries/Enquiries"))
const CreditNotes = lazy(() => import("./Components/CreditNotes/CreditNotes"))
const PublicInvoice = lazy(() => import("./Components/Invoices/PublicInvoice"))
const PublicQuote = lazy(() => import("./Components/Quotes/PublicQuote"))
const PublicLetter = lazy(() => import("./Components/Letters/PublicLetter"))
const PublicBill = lazy(() => import("./Components/Bills/PublicBill"))
const Quotes = lazy(() => import("./Components/Quotes/Quotes"))
const CreateQuote = lazy(() => import("./Components/Quotes/CreateQuote"))
const QuotePrint = lazy(() => import("./Components/Quotes/QuotePrint"))
const POPrint = lazy(() => import("./Components/PurchaseOrders/POPrint"))
const BillPrint = lazy(() => import("./Components/Bills/BillPrint"))
const SalesOrderPrint = lazy(() => import("./Components/SalesOrders/SalesOrderPrint"))

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
  const navigate = useNavigate()

  // Desktop only — a spifora:// link (e.g. from an invitation email's "Open
  // in Desktop App" fallback) lands here two ways: on_open_url fires while
  // the app is already running (macOS natively, Windows/Linux forwarded via
  // the single-instance "deep-link" feature — see src-tauri/src/lib.rs), and
  // getCurrent() covers the case where THIS launch of the app was the one
  // the OS spawned for the link. Both just strip the custom scheme down to
  // the path/query the app's own router already understands.
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return // plain web build — no desktop bridge to talk to

    const routeToDeepLink = (urls) => {
      const raw = urls?.[0]
      if (!raw) return
      navigate(raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '/'))
    }

    let unlisten
    onOpenUrl(routeToDeepLink).then((fn) => { unlisten = fn })
    getCurrent().then((urls) => { if (urls) routeToDeepLink(urls) })

    return () => { unlisten?.() }
  }, [navigate])

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
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Invitation accept — accessible when logged in, before org is set */}
            <Route path="/invitations/accept" element={<AcceptInvitation />} />

            {/* Create first org after signup (protected, but outside main layout) */}
            <Route
              path="/organizations/create"
              element={<ProtectedRoute><CreateOrganization /></ProtectedRoute>}
            />

            {/* Internal ops tool — gated by ADMIN_SECRET itself (own unlock
                screen), deliberately NOT wrapped in ProtectedRoute (no normal
                login required) and NOT linked from the Sidebar. */}

            {/* All protected routes inside main layout */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/Home" element={<Home />} />
              <Route path="/Items/Items" element={<Item />} />
              <Route path="/Items/Items/New" element={<New />} />
              <Route path="/Items/Items/Edit/:id" element={<New />} />
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
              <Route path="/Sales/Salesorders/:id/print" element={<SalesOrderPrint />} />
              <Route path="/Purchase/Purchaseorders" element={<Purchaseorders />} />
              <Route path="/Purchase/Purchaseorders/Newpurchaseorders" element={<Newpurchaseorders />} />
              <Route path="/Purchase/Purchaseorders/Newpurchaseorders/:id" element={<Newpurchaseorders />} />
              <Route path="/Purchase/Purchaseorders/:id/print" element={<POPrint />} />
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
              <Route path="/profile" element={<Profile />} />
              <Route path="/Sales/Invoices" element={<Invoices />} />
              <Route path="/Sales/Invoices/:id/print" element={<InvoicePrint />} />
              <Route path="/Sales/Createinvoices" element={<Createinvoices />} />
              <Route path="/Sales/RecurringInvoices" element={<RecurringInvoices />} />
              <Route path="/Sales/PaymentsReceived" element={<PaymentsReceived />} />
              <Route path="/Sales/AdvancePayments"   element={<AdvancePayments />} />
              <Route path="/Purchase/Bills" element={<Bills />} />
              <Route path="/Purchase/Bills/New" element={<NewBill />} />
              <Route path="/Purchase/Bills/Edit/:id" element={<NewBill />} />
              <Route path="/Purchase/Bills/:id/print" element={<BillPrint />} />
              <Route path="/Purchase/Expenses" element={<Expenses />} />
              <Route path="/Purchase/Expenses/New" element={<NewExpense />} />
              <Route path="/Purchase/PaymentsMade" element={<PaymentsMade />} />
              <Route path="/Purchase/VendorCredits" element={<VendorCredits />} />
              <Route path="/Approvals" element={<Approvals />} />
              <Route path="/Reports/export-transactions" element={<TransactionExport />} />
              <Route path="/Backups" element={<Backups />} />
              <Route path="/Letters" element={<Letters />} />
              <Route path="/Projects" element={<Projects />} />
              <Route path="/Letters/new" element={<LetterEditor />} />
              <Route path="/Letters/:id/edit" element={<LetterEditor />} />
              <Route path="/Letters/:id/print" element={<LetterPrint />} />
              {/* Same components, mounted under /HR — they read the pathname to
                  scope themselves to employee-addressed letters only, and stay
                  inside the HR nav section (see Letters.jsx/LetterEditor.jsx isHR). */}
              <Route path="/HR/Letters" element={<Letters />} />
              <Route path="/HR/Letters/new" element={<LetterEditor />} />
              <Route path="/HR/Letters/:id/edit" element={<LetterEditor />} />
              <Route path="/HR/Letters/:id/print" element={<LetterPrint />} />
              <Route path="/Reports/sales"                element={<SalesReport />} />
              <Route path="/Reports/sales-by-emirate"     element={<SalesByEmirate />} />
              <Route path="/Reports/purchases"            element={<PurchaseReport />} />
              <Route path="/Reports/inventory"            element={<InventoryReport />} />
              <Route path="/Reports/aging"                element={<AgingReport />} />
              <Route path="/Reports/customer-statement"   element={<CustomerStatement />} />
              <Route path="/Reports/vat"                  element={<VATReport />} />
              <Route path="/Reports/trial-balance"        element={<TrialBalance />} />
              <Route path="/Reports/profit-loss"          element={<ProfitLoss />} />
              <Route path="/Reports/balance-sheet"        element={<BalanceSheet />} />
              <Route path="/Reports/cash-flow"            element={<CashFlow />} />
              <Route path="/Reports/vendor-aging"         element={<VendorAging />} />
              <Route path="/Finance/Accounts"        element={<Accounts />} />
              <Route path="/Finance/Accounts/New"    element={<NewAccount />} />
              <Route path="/Finance/Accounts/:id/edit" element={<NewAccount />} />
              <Route path="/Finance/JournalEntries"  element={<JournalEntries />} />
              <Route path="/Finance/BankReconciliation" element={<BankReconciliation />} />
              <Route path="/Finance/ExchangeRates" element={<ExchangeRates />} />
              <Route path="/Items/item-groups"        element={<ItemGroups />} />
              <Route path="/Items/price-lists"        element={<PriceLists />} />
              <Route path="/Items/price-lists/new"    element={<NewPriceList />} />
              <Route path="/Inventory/stock-summary"  element={<StockSummary />} />
              <Route path="/Inventory/warehouses"     element={<Warehouses />} />
              <Route path="/HR/Employees"             element={<Employees />} />
              <Route path="/HR/OrgChart"              element={<OrgChart />} />
              <Route path="/HR/Payroll"               element={<Payroll />} />
              <Route path="/HR/Payroll/SalaryStructures" element={<SalaryStructures />} />
              <Route path="/HR/Payroll/Schedules"        element={<PayrollSchedules />} />
              <Route path="/HR/Payroll/:id"           element={<PayRunDetail />} />
              <Route path="/HR/TimeOff"               element={<LeaveRequests />} />
              <Route path="/HR/TimeOff/LeaveTypes"    element={<LeaveTypes />} />
              <Route path="/HR/TimeOff/Balances"      element={<LeaveBalances />} />
              <Route path="/Inventory/adjustments"    element={<Adjustments />} />
              <Route path="/Sales/CreditNotes"        element={<CreditNotes />} />
              <Route path="/Sales/Quotes"             element={<Quotes />} />
              <Route path="/Sales/Quotes/new"         element={<CreateQuote />} />
              <Route path="/Sales/Quotes/:id/print"   element={<QuotePrint />} />
              <Route path="/Sales/Quotes/:id"         element={<CreateQuote />} />
            </Route>

            {/* Public invoice/quote — no layout, no auth */}
            <Route path="/invoice/public/:token" element={<PublicInvoice />} />
            <Route path="/quote/public/:token" element={<PublicQuote />} />
            <Route path="/letter/public/:token" element={<PublicLetter />} />
            <Route path="/bill/public/:token" element={<PublicBill />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  )

}

export default App
