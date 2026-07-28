package utils

import (
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/backend/models"
	gomail "gopkg.in/gomail.v2"
)

// SendInvitationEmail sends an invitation link to the given email address.
//
// Required env vars in .env:
//
//	SMTP_HOST  — e.g. smtp.gmail.com
//	SMTP_PORT  — e.g. 587
//	SMTP_USER  — your Gmail address
//	SMTP_PASS  — Gmail App Password (16 chars, no spaces)
//	             Generate at: myaccount.google.com → Security → App Passwords
func SendInvitationEmail(toEmail, _, orgName, invitedBy, role, token string) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")

	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing)")
	}

	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}

	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5175"
	}

	inviteLink := fmt.Sprintf("%s/invitations/accept?token=%s", appURL, token)

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", fmt.Sprintf("You're invited to join %s on Spifora", orgName))
	m.SetBody("text/html", buildInviteEmailHTML(orgName, invitedBy, role, inviteLink))

	d := gomail.NewDialer(host, port, user, pass)

	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send invite to %s: %v", toEmail, err)
		return err
	}

	log.Printf("[email] Invite sent successfully to %s", toEmail)
	return nil
}

// SendLicenseKeyEmail sends a newly-approved license code to the customer —
// the automated replacement for an admin hand-copying the code out of the
// dashboard and pasting it into an email themselves.
func SendLicenseKeyEmail(toEmail, customerName, code, planName string, modules []string) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")
	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured")
	}
	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}

	greeting := "Hi there,"
	if customerName != "" {
		greeting = fmt.Sprintf("Hi %s,", customerName)
	}
	planLine := ""
	if planName != "" {
		planLine = fmt.Sprintf(`<p style="color:#64748b;font-size:13px;margin:0 0 4px;">Plan: <strong style="color:#e2e8f0;">%s</strong></p>`, planName)
	}
	modulesLine := ""
	if len(modules) > 0 {
		modulesLine = fmt.Sprintf(`<p style="color:#64748b;font-size:13px;margin:0;">Modules: <strong style="color:#e2e8f0;">%s</strong></p>`, strings.Join(modules, ", "))
	}

	html := fmt.Sprintf(`<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0f1e;">
<p style="color:#e2e8f0;font-size:15px;margin:0 0 8px">%s</p>
<p style="color:#94a3b8;font-size:14px;margin:0 0 20px">Your Spifora license is approved. Enter this key when creating your organization:</p>
<div style="font-size:20px;font-weight:800;letter-spacing:2px;color:#93c5fd;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px;text-align:center;font-family:ui-monospace,monospace;">%s</div>
<div style="margin:18px 0 0;padding:14px 16px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:10px;">
%s
%s
</div>
<p style="color:#475569;font-size:12px;margin:20px 0 0">Keep this code safe — treat it like a password. If you didn't request this, ignore this email.</p>
</div>`, greeting, code, planLine, modulesLine)

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", "Your Spifora license key")
	m.SetBody("text/html", html)
	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send license key to %s: %v", toEmail, err)
		return err
	}
	log.Printf("[email] License key sent to %s", toEmail)
	return nil
}

// SendLicenseUpgradeEmail confirms an organization-quota bump on a license the
// customer already holds — no new code involved, they keep using the one
// they have.
func SendLicenseUpgradeEmail(toEmail, customerName, code string, newMaxOrganizations, newMaxUsersPerOrg int) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")
	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured")
	}
	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}
	greeting := "Hi there,"
	if customerName != "" {
		greeting = fmt.Sprintf("Hi %s,", customerName)
	}
	usersLine := "Unlimited users per organization."
	if newMaxUsersPerOrg > 0 {
		usersLine = fmt.Sprintf("Up to <strong>%d</strong> users per organization.", newMaxUsersPerOrg)
	}
	html := fmt.Sprintf(`<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0f1e;">
<p style="color:#e2e8f0;font-size:15px;margin:0 0 8px">%s</p>
<p style="color:#94a3b8;font-size:14px;margin:0 0 20px">Your license has been upgraded — no need to change anything, keep using the same key:</p>
<div style="font-size:20px;font-weight:800;letter-spacing:2px;color:#93c5fd;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px;text-align:center;font-family:ui-monospace,monospace;">%s</div>
<p style="color:#e2e8f0;font-size:14px;margin:18px 0 0;">You can now create up to <strong>%d</strong> organizations with this key. %s</p>
</div>`, greeting, code, newMaxOrganizations, usersLine)

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", "Your Spifora license was upgraded")
	m.SetBody("text/html", html)
	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send upgrade confirmation to %s: %v", toEmail, err)
		return err
	}
	log.Printf("[email] Upgrade confirmation sent to %s", toEmail)
	return nil
}

// SendLicenseRequestNotification alerts the admin that a new self-serve
// license request landed in the "pending" queue — otherwise it just sits in
// Mongo until someone happens to open /admin/licenses. Goes to
// ADMIN_NOTIFY_EMAIL if set, else ajal@spifora.com.
func SendLicenseRequestNotification(customerName, customerEmail, planName string, maxOrganizations int, requestedModules []string) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")
	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured")
	}
	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}
	to := os.Getenv("ADMIN_NOTIFY_EMAIL")
	if to == "" {
		to = "ajal@spifora.com"
	}

	planLine := planName
	if planLine == "" {
		planLine = "—"
	}
	html := fmt.Sprintf(`<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0f1e;">
<p style="color:#e2e8f0;font-size:15px;margin:0 0 16px">New license request</p>
<table style="width:100%%;border-collapse:collapse;font-size:13px;">
<tr><td style="padding:4px 0;color:#64748b;">Customer</td><td style="padding:4px 0;color:#e2e8f0;font-weight:700;">%s</td></tr>
<tr><td style="padding:4px 0;color:#64748b;">Email</td><td style="padding:4px 0;color:#e2e8f0;">%s</td></tr>
<tr><td style="padding:4px 0;color:#64748b;">Plan</td><td style="padding:4px 0;color:#e2e8f0;">%s</td></tr>
<tr><td style="padding:4px 0;color:#64748b;">Orgs requested</td><td style="padding:4px 0;color:#e2e8f0;">%d</td></tr>
<tr><td style="padding:4px 0;color:#64748b;vertical-align:top;">Modules</td><td style="padding:4px 0;color:#e2e8f0;">%s</td></tr>
</table>
<p style="color:#475569;font-size:12px;margin:20px 0 0">Review and approve/reject at /admin/licenses.</p>
</div>`, customerName, customerEmail, planLine, maxOrganizations, strings.Join(requestedModules, ", "))

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", to)
	m.SetHeader("Subject", "New license request — "+customerName)
	m.SetBody("text/html", html)
	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send license request notification: %v", err)
		return err
	}
	log.Printf("[email] License request notification sent to %s", to)
	return nil
}

// SendLoginOTPEmail sends a one-time login code to verify a new/changed device.
func SendLoginOTPEmail(toEmail, otp string) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")
	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured")
	}
	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}
	html := fmt.Sprintf(`<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h2 style="color:#1e3a5f;margin:0 0 8px">Your login verification code</h2>
<p style="color:#475569;font-size:14px;margin:0 0 18px">We noticed a sign-in from a new device. Enter this code to continue:</p>
<div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#1e3a5f;background:#f1f5f9;border-radius:10px;padding:16px;text-align:center">%s</div>
<p style="color:#94a3b8;font-size:12px;margin:18px 0 0">This code expires in 10 minutes. If you didn't try to sign in, change your password.</p>
</div>`, otp)

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", "Your Spifora login code")
	m.SetBody("text/html", html)
	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send OTP to %s: %v", toEmail, err)
		return err
	}
	log.Printf("[email] Login OTP sent to %s", toEmail)
	return nil
}

// SendPasswordResetEmail sends a one-time code to verify a password-reset
// request. Same shape as SendLoginOTPEmail — different copy, shorter expiry
// (15 min vs the login OTP's 10 — see auth_controller.go ForgotPassword).
func SendPasswordResetEmail(toEmail, otp string) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")
	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured")
	}
	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}
	html := fmt.Sprintf(`<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h2 style="color:#1e3a5f;margin:0 0 8px">Reset your password</h2>
<p style="color:#475569;font-size:14px;margin:0 0 18px">Enter this code to choose a new password:</p>
<div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#1e3a5f;background:#f1f5f9;border-radius:10px;padding:16px;text-align:center">%s</div>
<p style="color:#94a3b8;font-size:12px;margin:18px 0 0">This code expires in 15 minutes. If you didn't request this, ignore this email — your password stays unchanged.</p>
</div>`, otp)

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", "Reset your Spifora password")
	m.SetBody("text/html", html)
	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send password reset OTP to %s: %v", toEmail, err)
		return err
	}
	log.Printf("[email] Password reset OTP sent to %s", toEmail)
	return nil
}

// SendInvoiceEmail sends an invoice or payment reminder email to a customer.
// isReminder=true sends the overdue reminder variant.
func SendInvoiceEmail(toEmail string, inv models.Invoice, customMessage string, isReminder bool) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")

	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing)")
	}

	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}

	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		//appURL = "http://localhost:5175"
		appURL = "spifora.vercel.app/"
	}

	var subject string
	if isReminder {
		subject = fmt.Sprintf("Payment Reminder: %s is overdue", inv.InvoiceNumber)
	} else {
		subject = fmt.Sprintf("Invoice %s from Spifora", inv.InvoiceNumber)
	}

	publicLink := ""
	if inv.PublicToken != "" {
		publicLink = fmt.Sprintf("%s/invoice/public/%s", appURL, inv.PublicToken)
	}

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", subject)
	m.SetBody("text/html", buildInvoiceEmailHTML(inv, publicLink, customMessage, isReminder))

	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send invoice email to %s: %v", toEmail, err)
		return err
	}

	log.Printf("[email] Invoice email sent to %s", toEmail)
	return nil
}

// SendQuoteEmail emails a quote to one or more recipients. When pdfBytes is non-empty
// it's attached as <quote-number>.pdf.
func SendQuoteEmail(toEmails []string, q models.Quote, customMessage string, pdfBytes []byte) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")

	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing)")
	}
	if len(toEmails) == 0 {
		return fmt.Errorf("no recipients")
	}

	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}

	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}

	// appURL must be the FRONTEND's public URL — see SendInvitationEmail for why.
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5175"
	}
	publicLink := ""
	if q.PublicToken != "" {
		publicLink = fmt.Sprintf("%s/quote/public/%s", appURL, q.PublicToken)
	}

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmails...)
	m.SetHeader("Subject", fmt.Sprintf("Quote %s from Spifora", q.QuoteNumber))
	m.SetBody("text/html", buildQuoteEmailHTML(q, publicLink, customMessage))
	if len(pdfBytes) > 0 {
		name := "quote-" + q.QuoteNumber + ".pdf"
		m.Attach(name, gomail.SetCopyFunc(func(w io.Writer) error {
			_, err := w.Write(pdfBytes)
			return err
		}), gomail.SetHeader(map[string][]string{"Content-Type": {"application/pdf"}}))
	}

	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send quote email to %v: %v", toEmails, err)
		return err
	}

	log.Printf("[email] Quote email sent to %v", toEmails)
	return nil
}

func buildQuoteEmailHTML(q models.Quote, publicLink, customMessage string) string {
	msgBlock := ""
	if strings.TrimSpace(customMessage) != "" {
		msgBlock = fmt.Sprintf(`<p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;">%s</p>`, customMessage)
	}
	validBlock := ""
	if q.ValidUntil != "" {
		validBlock = fmt.Sprintf(`<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Valid until</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">%s</td></tr>`, q.ValidUntil)
	}
	subject := q.Subject
	if subject == "" {
		subject = "—"
	}
	ctaBlock := ""
	if publicLink != "" {
		ctaBlock = fmt.Sprintf(`
		<table cellpadding="0" cellspacing="0" width="100%%">
		  <tr><td align="center" style="padding:8px 0 20px;">
		    <a href="%s" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9px;font-size:14px;font-weight:600;">View Quote</a>
		  </td></tr>
		</table>`, publicLink)
	}
	return fmt.Sprintf(`<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="background:#3b82f6;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;">Quote %s</h1>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;color:#0f172a;font-size:15px;">Dear %s,</p>
        %s
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">Please find your quotation summary below.</p>
        <table style="width:100%%;border-collapse:collapse;margin:8px 0 16px;">
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Quote No.</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">%s</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Subject</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">%s</td></tr>
          %s
          <tr><td style="padding:10px 0 0;color:#0f172a;font-size:15px;font-weight:700;border-top:1px solid #e2e8f0;">Grand Total</td><td style="padding:10px 0 0;text-align:right;color:#0f172a;font-size:15px;font-weight:800;border-top:1px solid #e2e8f0;">AED %s</td></tr>
        </table>
        %s
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">Sent via Spifora</p>
      </div>
    </div>
  </div>
</body></html>`,
		q.QuoteNumber,
		q.CustomerName,
		msgBlock,
		q.QuoteNumber,
		subject,
		validBlock,
		fmt.Sprintf("%.2f", q.Totals.GrandTotal),
		ctaBlock,
	)
}

// SendBillEmail emails a bill to one or more recipients (typically the vendor
// confirming receipt/terms). When pdfBytes is non-empty it's attached as
// <bill-number>.pdf.
func SendBillEmail(toEmails []string, b models.Bill, customMessage string, pdfBytes []byte) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")

	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing)")
	}
	if len(toEmails) == 0 {
		return fmt.Errorf("no recipients")
	}

	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}

	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5175"
	}
	publicLink := ""
	if b.PublicToken != "" {
		publicLink = fmt.Sprintf("%s/bill/public/%s", appURL, b.PublicToken)
	}

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmails...)
	m.SetHeader("Subject", fmt.Sprintf("Bill %s from Spifora", b.BillNumber))
	m.SetBody("text/html", buildBillEmailHTML(b, publicLink, customMessage))
	if len(pdfBytes) > 0 {
		name := "bill-" + b.BillNumber + ".pdf"
		m.Attach(name, gomail.SetCopyFunc(func(w io.Writer) error {
			_, err := w.Write(pdfBytes)
			return err
		}), gomail.SetHeader(map[string][]string{"Content-Type": {"application/pdf"}}))
	}

	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send bill email to %v: %v", toEmails, err)
		return err
	}

	log.Printf("[email] Bill email sent to %v", toEmails)
	return nil
}

func buildBillEmailHTML(b models.Bill, publicLink, customMessage string) string {
	msgBlock := ""
	if strings.TrimSpace(customMessage) != "" {
		msgBlock = fmt.Sprintf(`<p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;">%s</p>`, customMessage)
	}
	ctaBlock := ""
	if publicLink != "" {
		ctaBlock = fmt.Sprintf(`
		<table cellpadding="0" cellspacing="0" width="100%%">
		  <tr><td align="center" style="padding:8px 0 20px;">
		    <a href="%s" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9px;font-size:14px;font-weight:600;">View Bill</a>
		  </td></tr>
		</table>`, publicLink)
	}
	return fmt.Sprintf(`<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="background:#3b82f6;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;">Bill %s</h1>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;color:#0f172a;font-size:15px;">Dear %s,</p>
        %s
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">Please find the bill summary below.</p>
        <table style="width:100%%;border-collapse:collapse;margin:8px 0 16px;">
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Bill No.</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">%s</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Due Date</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">%s</td></tr>
          <tr><td style="padding:10px 0 0;color:#0f172a;font-size:15px;font-weight:700;border-top:1px solid #e2e8f0;">Grand Total</td><td style="padding:10px 0 0;text-align:right;color:#0f172a;font-size:15px;font-weight:800;border-top:1px solid #e2e8f0;">AED %s</td></tr>
        </table>
        %s
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">Sent via Spifora</p>
      </div>
    </div>
  </div>
</body></html>`,
		b.BillNumber,
		b.VendorName,
		msgBlock,
		b.BillNumber,
		b.DueDate,
		fmt.Sprintf("%.2f", b.Totals.GrandTotal),
		ctaBlock,
	)
}

func buildInvoiceEmailHTML(inv models.Invoice, publicLink, customMessage string, isReminder bool) string {
	accentColor := "#3b82f6"
	headerTitle := fmt.Sprintf("Invoice %s", inv.InvoiceNumber)
	ctaText := "View Invoice"
	if isReminder {
		accentColor = "#ef4444"
		headerTitle = fmt.Sprintf("Payment Reminder — %s", inv.InvoiceNumber)
		ctaText = "Pay Now"
	}

	msgBlock := ""
	if customMessage != "" {
		msgBlock = fmt.Sprintf(`<p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">%s</p>`, customMessage)
	}

	ctaBlock := ""
	if publicLink != "" {
		ctaBlock = fmt.Sprintf(`
		<table cellpadding="0" cellspacing="0" width="100%%">
		  <tr><td align="center" style="padding-top:8px;">
		    <a href="%s" style="display:inline-block;background:%s;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9px;font-size:14px;font-weight:600;">%s</a>
		  </td></tr>
		</table>`, publicLink, accentColor, ctaText)
	}

	reminderNote := ""
	if isReminder {
		reminderNote = `<p style="color:#ef4444;font-size:13px;font-weight:600;margin:0 0 20px;padding:10px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;">
		  ⚠️ This invoice is overdue. Please arrange payment at your earliest convenience.
		</p>`
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 20px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#0c1220;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a,#0f172a);padding:28px 36px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:34px;height:34px;background:#2563eb;border-radius:8px;text-align:center;vertical-align:middle;">
                <span style="color:#fff;font-size:17px;font-weight:800;">S</span>
              </td>
              <td style="padding-left:10px;color:#fff;font-size:17px;font-weight:700;">SPIFORA</td>
            </tr></table>
            <h1 style="color:#fff;font-size:20px;font-weight:700;margin:16px 0 0;">%s</h1>
          </td>
        </tr>

        <tr><td style="padding:32px 36px;">
          %s
          %s

          <table width="100%%" cellpadding="0" cellspacing="0" style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:20px 22px;">
              <table cellpadding="0" cellspacing="0" width="100%%">
                <tr>
                  <td style="color:#64748b;font-size:12px;padding-bottom:10px;">Invoice Number</td>
                  <td align="right" style="color:#e2e8f0;font-size:13px;font-weight:600;padding-bottom:10px;">%s</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:12px;padding-bottom:10px;">Invoice Date</td>
                  <td align="right" style="color:#e2e8f0;font-size:13px;padding-bottom:10px;">%s</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:12px;padding-bottom:10px;">Due Date</td>
                  <td align="right" style="color:#e2e8f0;font-size:13px;padding-bottom:10px;">%s</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:12px;font-weight:700;">Amount Due</td>
                  <td align="right" style="color:%s;font-size:16px;font-weight:800;">%s %.2f</td>
                </tr>
              </table>
            </td></tr>
          </table>

          %s
        </td></tr>

        <tr>
          <td style="background:#080d1a;padding:16px 36px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="color:#334155;font-size:11px;margin:0;text-align:center;">Spifora · This is an automated email, please do not reply directly.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
		headerTitle,
		reminderNote,
		msgBlock,
		inv.InvoiceNumber,
		inv.IssueDate,
		inv.DueDate,
		accentColor,
		inv.Currency, inv.BalanceDue,
		ctaBlock,
	)
}

func buildInviteEmailHTML(orgName, invitedBy, role, inviteLink string) string {
	roleColor := map[string]string{
		"admin":  "#60a5fa",
		"member": "#4ade80",
		"viewer": "#94a3b8",
	}
	color := roleColor[role]
	if color == "" {
		color = "#94a3b8"
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0c1220;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a,#0f172a);padding:32px 36px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:36px;height:36px;background:#2563eb;border-radius:8px;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:18px;font-weight:800;">S</span>
                </td>
                <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">SPIFORA</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            <h1 style="color:#e2e8f0;font-size:22px;font-weight:700;margin:0 0 8px;">You're invited!</h1>
            <p style="color:#64748b;font-size:14px;margin:0 0 28px;">
              <strong style="color:#94a3b8;">%s</strong> has invited you to join their organization on Spifora.
            </p>

            <!-- Org card -->
            <table width="100%%" cellpadding="0" cellspacing="0" style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 22px;">
                  <table cellpadding="0" cellspacing="0" width="100%%">
                    <tr>
                      <td style="color:#64748b;font-size:12px;">Organization</td>
                      <td align="right" style="color:#e2e8f0;font-size:13px;font-weight:600;">%s</td>
                    </tr>
                    <tr><td colspan="2" style="height:10px;"></td></tr>
                    <tr>
                      <td style="color:#64748b;font-size:12px;">Your role</td>
                      <td align="right">
                        <span style="background:rgba(59,130,246,0.15);color:%s;border:1px solid rgba(59,130,246,0.25);padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;text-transform:capitalize;">%s</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" width="100%%">
              <tr>
                <td align="center">
                  <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:0.2px;">
                    Accept Invitation
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#475569;font-size:11px;text-align:center;margin:22px 0 0;">
              Or copy this link into your browser:<br>
              <a href="%s" style="color:#60a5fa;word-break:break-all;">%s</a>
            </p>
            <p style="color:#334155;font-size:11px;text-align:center;margin:16px 0 0;">
              This invitation expires in 7 days. If you did not expect this, you can safely ignore it.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#080d1a;padding:16px 36px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="color:#334155;font-size:11px;margin:0;text-align:center;">Spifora · Sent by %s</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
		invitedBy,
		orgName, color, role,
		inviteLink,
		inviteLink, inviteLink,
		invitedBy,
	)
}

// SendLetterEmail emails an issued letter with its PDF attached — same
// attach-bytes pattern as SendQuoteEmail (in-memory PDF, no temp file).
func SendLetterEmail(toEmails []string, l models.Letter, customMessage string, pdfBytes []byte) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")

	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing)")
	}
	if len(toEmails) == 0 {
		return fmt.Errorf("no recipients")
	}

	port := 587
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}

	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5175"
	}
	publicLink := ""
	if l.PublicToken != "" {
		publicLink = fmt.Sprintf("%s/letter/public/%s", appURL, l.PublicToken)
	}

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmails...)
	m.SetHeader("Subject", fmt.Sprintf("%s — %s", l.Title, l.LetterNumber))
	m.SetBody("text/html", buildLetterEmailHTML(l, publicLink, customMessage))
	if len(pdfBytes) > 0 {
		name := "letter-" + l.LetterNumber + ".pdf"
		m.Attach(name, gomail.SetCopyFunc(func(w io.Writer) error {
			_, err := w.Write(pdfBytes)
			return err
		}), gomail.SetHeader(map[string][]string{"Content-Type": {"application/pdf"}}))
	}

	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send letter email to %v: %v", toEmails, err)
		return err
	}

	log.Printf("[email] Letter email sent to %v", toEmails)
	return nil
}

// SendPayslipEmail emails a payslip PDF to the employee. Always carries the
// PDF as an attachment — unlike invoices/quotes/bills there is no public
// "view online" link, since salary data shouldn't sit behind a guessable
// token URL.
func SendPayslipEmail(toEmail string, p models.Payslip, pdfBytes []byte) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")

	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return fmt.Errorf("email service not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing)")
	}

	port := 587
	if portStr != "" {
		if pNum, err := strconv.Atoi(portStr); err == nil {
			port = pNum
		}
	}

	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}

	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("Spifora <%s>", from))
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", fmt.Sprintf("Payslip %s — %s", p.PayslipNumber, p.PeriodStart))
	m.SetBody("text/html", buildPayslipEmailHTML(p))
	if len(pdfBytes) > 0 {
		name := "payslip-" + p.PayslipNumber + ".pdf"
		m.Attach(name, gomail.SetCopyFunc(func(w io.Writer) error {
			_, err := w.Write(pdfBytes)
			return err
		}), gomail.SetHeader(map[string][]string{"Content-Type": {"application/pdf"}}))
	}

	d := gomail.NewDialer(host, port, user, pass)
	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send payslip email to %s: %v", toEmail, err)
		return err
	}

	log.Printf("[email] Payslip email sent to %s", toEmail)
	return nil
}

func buildPayslipEmailHTML(p models.Payslip) string {
	return fmt.Sprintf(`<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="background:#1e3a5f;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;">Payslip %s</h1>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;color:#0f172a;font-size:15px;">Dear %s,</p>
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">Your payslip for the period %s to %s is attached as a PDF.</p>
        <table style="width:100%%;border-collapse:collapse;margin:8px 0 16px;">
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Pay Date</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">%s</td></tr>
          <tr><td style="padding:10px 0 0;color:#0f172a;font-size:15px;font-weight:700;border-top:1px solid #e2e8f0;">Net Pay</td><td style="padding:10px 0 0;text-align:right;color:#0f172a;font-size:15px;font-weight:800;border-top:1px solid #e2e8f0;">%s %.2f</td></tr>
        </table>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">Sent via Spifora · This is an automated email, please do not reply directly.</p>
      </div>
    </div>
  </div>
</body></html>`,
		p.PayslipNumber,
		p.EmployeeName,
		p.PeriodStart, p.PeriodEnd,
		p.PayDate,
		p.Currency, p.NetPay,
	)
}

func buildLetterEmailHTML(l models.Letter, publicLink, customMessage string) string {
	msgBlock := ""
	if strings.TrimSpace(customMessage) != "" {
		msgBlock = fmt.Sprintf(`<p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;">%s</p>`, customMessage)
	}
	greeting := "Dear Sir/Madam,"
	if l.CustomerName != "" {
		greeting = fmt.Sprintf("Dear %s,", l.CustomerName)
	}
	ctaBlock := ""
	if publicLink != "" {
		ctaBlock = fmt.Sprintf(`
		<table cellpadding="0" cellspacing="0" width="100%%">
		  <tr><td align="center" style="padding:8px 0 20px;">
		    <a href="%s" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9px;font-size:14px;font-weight:600;">View Letter</a>
		  </td></tr>
		</table>`, publicLink)
	}
	return fmt.Sprintf(`<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="background:#3b82f6;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;">%s</h1>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;color:#0f172a;font-size:15px;">%s</p>
        %s
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">Please find the letter attached as a PDF.</p>
        %s
      </div>
    </div>
  </div>
</body></html>`,
		l.Title, greeting, msgBlock, ctaBlock,
	)
}
