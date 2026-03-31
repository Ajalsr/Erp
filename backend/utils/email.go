package utils

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	gomail "gopkg.in/gomail.v2"
)

// SendInvitationEmail sends an invitation link to the given email address.
//
// Required env vars in .env:
//   SMTP_HOST  — e.g. smtp.gmail.com
//   SMTP_PORT  — e.g. 587
//   SMTP_USER  — your Gmail address
//   SMTP_PASS  — Gmail App Password (16 chars, no spaces)
//                Generate at: myaccount.google.com → Security → App Passwords
func SendInvitationEmail(toEmail, _, orgName, invitedBy, role, token string) error {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")

	if host == "" || user == "" || pass == "" {
		log.Println("[email] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
		return nil
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
	m.SetHeader("From", fmt.Sprintf("Nexus ERP <%s>", from))
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", fmt.Sprintf("You're invited to join %s on Nexus ERP", orgName))
	m.SetBody("text/html", buildInviteEmailHTML(orgName, invitedBy, role, inviteLink))

	d := gomail.NewDialer(host, port, user, pass)

	if err := d.DialAndSend(m); err != nil {
		log.Printf("[email] Failed to send invite to %s: %v", toEmail, err)
		return err
	}

	log.Printf("[email] Invite sent successfully to %s", toEmail)
	return nil
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
                  <span style="color:#fff;font-size:18px;font-weight:800;">N</span>
                </td>
                <td style="padding-left:10px;color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">NEXUS ERP</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            <h1 style="color:#e2e8f0;font-size:22px;font-weight:700;margin:0 0 8px;">You're invited!</h1>
            <p style="color:#64748b;font-size:14px;margin:0 0 28px;">
              <strong style="color:#94a3b8;">%s</strong> has invited you to join their organization on Nexus ERP.
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
            <p style="color:#334155;font-size:11px;margin:0;text-align:center;">Nexus ERP · Sent by %s</p>
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
