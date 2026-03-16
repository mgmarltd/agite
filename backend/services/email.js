const nodemailer = require('nodemailer');
const db = require('../database');

function getSmtpSettings() {
  const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name'];
  const settings = {};
  for (const key of keys) {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    settings[key] = row?.value || '';
  }
  return settings;
}

function createTransporter() {
  const { smtp_host, smtp_port, smtp_user, smtp_pass } = getSmtpSettings();

  if (!smtp_host || !smtp_user || !smtp_pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtp_host,
    port: parseInt(smtp_port) || 587,
    secure: parseInt(smtp_port) === 465,
    auth: {
      user: smtp_user,
      pass: smtp_pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

function buildVerificationEmail(confirmUrl, baseUrl) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#000000;max-width:600px;width:100%;">

<!-- Logo -->
<tr><td align="center" style="padding:60px 40px 30px;">
  <img src="${baseUrl}/logo192.png" alt="AGIT\u00C9" width="180" style="display:block;" />
</td></tr>

<!-- English Section -->
<tr><td align="center" style="padding:10px 40px 0;">
  <h1 style="color:#ffffff;font-size:28px;font-weight:800;letter-spacing:1px;margin:0;">YOU'RE ALMOST INSIDE</h1>
</td></tr>

<tr><td align="center" style="padding:40px 40px 0;">
  <a href="${confirmUrl}" target="_blank" style="display:inline-block;background-color:#ffffff;color:#000000;font-size:14px;font-weight:800;text-decoration:none;padding:14px 32px;letter-spacing:1px;">CONFIRM ACCESS</a>
</td></tr>

<tr><td align="center" style="padding:35px 40px 0;">
  <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0;">Confirm your email to stay connected.</p>
</td></tr>

<tr><td align="center" style="padding:20px 40px 0;">
  <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0;line-height:1.5;">Be the first to access new collections, limited releases, and exclusive updates from AGIT\u00C9.</p>
</td></tr>

<tr><td align="center" style="padding:30px 40px 0;">
  <p style="color:#999999;font-size:12px;font-weight:700;margin:0;line-height:1.6;">If you didn't request this email, you can safely ignore it.<br>If you have any questions, simply reply to this email \u2014 we'll be happy to help.</p>
</td></tr>

<!-- Divider -->
<tr><td style="padding:40px 40px 0;"><hr style="border:none;border-top:1px solid #222;margin:0;"></td></tr>

<!-- Turkish Section -->
<tr><td align="center" style="padding:40px 40px 0;">
  <h1 style="color:#ffffff;font-size:28px;font-weight:800;letter-spacing:1px;margin:0;">NEREDEYSE \u0130\u00C7ERDES\u0130N</h1>
</td></tr>

<tr><td align="center" style="padding:30px 40px 0;">
  <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0;">Eri\u015Fimini tamamlamak i\u00E7in e-postan\u0131 onayla.</p>
</td></tr>

<tr><td align="center" style="padding:20px 40px 0;">
  <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0;line-height:1.5;">AGIT\u00C9'den yeni koleksiyonlara, s\u0131n\u0131rl\u0131 \u00FCretim par\u00E7alara ve \u00F6zel g\u00FCncellemelere ilk eri\u015Fen sen ol.</p>
</td></tr>

<tr><td align="center" style="padding:30px 40px 60px;">
  <p style="color:#999999;font-size:12px;font-weight:700;margin:0;line-height:1.6;">Bu e-postay\u0131 sen talep etmediysen g\u00F6rmezden gelebilirsin. Herhangi bir sorunda bu e-postay\u0131 yan\u0131tlaman yeterli - yard\u0131mc\u0131 olmaktan memnuniyet duyar\u0131z.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendVerificationEmail(email, token) {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }

  const { smtp_from_email, smtp_from_name } = getSmtpSettings();

  // Build confirm URL from the site domain setting or fallback
  const siteUrl = db.prepare("SELECT value FROM settings WHERE key = ?").get('site_url');
  const baseUrl = siteUrl?.value || 'https://agitebrand.com';
  const confirmUrl = `${baseUrl}/api/subscribers/verify/${token}`;

  try {
    await transporter.sendMail({
      from: smtp_from_name ? `"${smtp_from_name}" <${smtp_from_email}>` : smtp_from_email,
      to: email,
      subject: "Confirm your access - AGIT\u00C9",
      html: buildVerificationEmail(confirmUrl, baseUrl),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendVerificationEmail, getSmtpSettings };
