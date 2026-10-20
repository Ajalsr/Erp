# Spifora ERP

A multi-tenant ERP for small and mid-sized businesses in the UAE and the Gulf, covering accounting, inventory, sales and purchasing, with UAE VAT built in.

🌐 **Website:** [spifora.com](https://app.spifora.com) · **Status:** beta, in use by early customers

<img src="https://github.com/user-attachments/assets/b16a5e10-ef6b-4605-ac80-fec7cf36e817" alt="Spifora dashboard" width="100%">

<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/e02af746-fffd-47af-afda-954df3ed7715" alt="Trial Balance report"></td>
    <td><img src="https://github.com/user-attachments/assets/bdae7055-5042-4d3e-9e90-4ffd291add77" alt="Sales Orders"></td>
  </tr>
  <tr>
    <td align="center">Trial Balance</td>
    <td align="center">Sales Orders</td>
  </tr>
  <tr>
    <td colspan="2"><img src="https://github.com/user-attachments/assets/bb7ae7f1-2ff1-4664-bace-89618c6f1c54" alt="Purchase Orders"></td>
  </tr>
  <tr>
    <td colspan="2" align="center">Purchase Orders</td>
  </tr>
</table>

## Features

**Accounting**
- Chart of Accounts, general ledger journal entries, payment and purchase vouchers
- Trial Balance, Balance Sheet and Profit & Loss reports
- UAE VAT handling in line with FTA requirements
- Fiscal-year opening balances with auditor overrides
- Recurring invoices on a schedule, customer advances and credit handling

**Inventory**
- Perpetual inventory with GRNI and COGS postings
- Moving-average costing
- Stock reservation on sales orders, deduction on goods receipt

**Sales & purchasing**
- Sales orders, purchase orders and goods receipt notes (GRN)
- Purchase order approval workflow
- Linked SO ↔ PO tracking, vendor and customer statements of account

**Platform**
- Multi-tenant: every organisation's data is isolated
- JWT authentication with organisation-scoped access
- Module-based licensing with machine activation
- Web app plus a Windows desktop app (Tauri)
- Rolling 30-day backups and transaction export to Excel

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Go (Gin) |
| Frontend | React 19, Vite |
| Database | [MongoDB / SQL Server — confirm] |
| Desktop | Tauri |
| Hosting | Vercel (frontend), Render (backend) |

## Getting started

### Prerequisites
- Node.js 18+
- Go 1.22+
- [Database] running locally

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
# [add the real commands, e.g.]
cd backend
go run .
```

Copy `.env.example` to `.env` and fill in your own values before running. Never commit real credentials.

## Author

**Ajal S R** — full stack software engineer, Dubai
[LinkedIn](https://www.linkedin.com/in/ajal-s-r-25951b1b4) · [GitHub](https://github.com/Ajalsr)
