const nodemailer = require("nodemailer");

// Create transport with fallback for dev/testing
const host = process.env.SMTP_HOST || "smtp.ethereal.email";
const port = parseInt(process.env.SMTP_PORT || "587");
const user = process.env.SMTP_USER || "mock_user";
const pass = "psvh fdds pzqq ybgf";
const from = process.env.SMTP_FROM || "no-reply@ai-hids.local";

let transporter;
try {
  const isGmail = host.includes("gmail") || user.endsWith("@gmail.com");
  const transportConfig = isGmail 
    ? {
        service: "gmail",
        auth: {
          user,
          pass
        }
      }
    : {
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        },
        tls: {
          rejectUnauthorized: false
        }
      };

  transporter = nodemailer.createTransport(transportConfig);
} catch (e) {
  console.error("[-] Email transporter initialization failed:", e.message);
}

/**
 * Core send helper
 */
const sendEmail = async ({ to, subject, html }) => {
  if (!transporter) {
    console.warn("[-] SMTP transporter not initialized. Skipping email to:", to);
    return;
  }
  if (!to) {
    console.warn("[-] No email address provided. Skipping mail dispatch.");
    return;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html
    });
    console.log(`[+] Email successfully dispatched to ${to}. Message ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[-] Failed to dispatch email to ${to}:`, err.message);
  }
};

const serverStartupTime = Date.now();
const sentAlertKeys = new Set();

/**
 * Format and send Threat Alert notification email
 */
const sendAlertEmail = async (toEmail, alert) => {
  // Forget all past alerts before server startup
  const alertTime = alert.timestamp ? new Date(alert.timestamp).getTime() : Date.now();
  if (alertTime < serverStartupTime) {
    console.log(`[~] Ignored past alert email trigger: ${alert.process_name || 'unknown'} (Timestamp: ${alert.timestamp})`);
    return;
  }

  // Deduplicate: send email once per alert type (classification / process_name)
  const alertType = alert.classification || alert.process_name || 'generic-anomaly';
  const dedupKey = `${toEmail}-${alertType}`;
  if (sentAlertKeys.has(dedupKey)) {
    console.log(`[~] Duplicate alert email suppressed for: ${toEmail} | Type: ${alertType}`);
    return;
  }

  // Register immediately to prevent rapid-fire duplicates
  sentAlertKeys.add(dedupKey);

  const riskVal = typeof alert.risk_score === 'number' ? alert.risk_score : 0;
  const isCritical = riskVal >= 70;
  const badgeColor = isCritical ? '#f43f5e' : '#f59e0b';
  const badgeBg = isCritical ? 'rgba(244, 63, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)';

  const html = `
    <div style="font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; color: #f3f4f6; padding: 40px 20px; text-align: center;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 32px; text-align: left; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px;">
          <div style="padding: 10px; background-color: ${badgeBg}; border: 1px solid ${badgeColor}40; border-radius: 8px; color: ${badgeColor}; font-weight: bold; font-size: 18px; line-height: 1;">
            ⚠️
          </div>
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.025em; color: #f3f4f6;">SECURITY THREAT DETECTED</h2>
            <span style="font-size: 9px; color: #818cf8; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">AI-HIDS Intrusion Dispatch</span>
          </div>
        </div>

        <!-- Alert Data Grid -->
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin-bottom: 20px;">
          A Host Intrusion Detection System alert has occurred with high confidence on one of your group's sensors. Below are the forensics details:
        </p>

        <div style="background-color: #020617; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; font-family: monospace; font-size: 12px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">
            <span style="color: #6b7280;">Sensor ID</span>
            <span style="color: #e5e7eb; font-weight: bold;">${alert.sensor_id}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">
            <span style="color: #6b7280;">Process Name</span>
            <span style="color: #f43f5e; font-weight: bold;">${alert.process_name}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">
            <span style="color: #6b7280;">PID</span>
            <span style="color: #e5e7eb;">${alert.pid}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">
            <span style="color: #6b7280;">Risk Level</span>
            <span style="color: ${badgeColor}; font-weight: bold;">${riskVal}%</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 8px;">
            <span style="color: #6b7280;">Classification</span>
            <span style="color: #e5e7eb; font-weight: bold; text-transform: capitalize;">${alert.classification || "Anomaly"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 0px;">
            <span style="color: #6b7280;">Timestamp</span>
            <span style="color: #9ca3af;">${new Date(alert.timestamp).toUTCString()}</span>
          </div>
        </div>

        <p style="font-size: 11px; color: #6b7280; line-height: 1.5; margin: 0; text-align: center;">
          This is an automated threat dispatch email. If you wish to disable email alerts for this security cell, update your group settings on the dashboard.
        </p>

      </div>
    </div>
  `;

  return sendEmail({
    to: toEmail,
    subject: `[AI-IDS ALERT] Threat Detected on Sensor ${alert.sensor_id} (${riskVal}% Risk)`,
    html
  });
};

/**
 * Format and send Member Join Request email
 */
const sendJoinRequestEmail = async (leaderEmail, requesterName, groupName) => {
  const html = `
    <div style="font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; color: #f3f4f6; padding: 40px 20px; text-align: center;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 32px; text-align: left; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px;">
          <div style="padding: 10px; background-color: rgba(99, 102, 241, 0.1); border: 1px solid #6366f140; border-radius: 8px; color: #6366f1; font-weight: bold; font-size: 18px; line-height: 1;">
            👥
          </div>
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.025em; color: #f3f4f6;">CELL MEMBERSHIP REQUEST</h2>
            <span style="font-size: 9px; color: #818cf8; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">AI-HIDS Group Actions</span>
          </div>
        </div>

        <p style="font-size: 13px; color: #e5e7eb; line-height: 1.6; margin-bottom: 20px;">
          Hello Cell Leader,
        </p>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin-bottom: 20px;">
          A user <strong>${requesterName}</strong> has requested to join your collaborative security cell <strong>${groupName}</strong>.
        </p>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin-bottom: 24px;">
          Please log into the dashboard console to approve or reject this request.
        </p>

        <p style="font-size: 11px; color: #6b7280; line-height: 1.5; margin: 0; text-align: center;">
          This is an automated cell management notification.
        </p>

      </div>
    </div>
  `;

  return sendEmail({
    to: leaderEmail,
    subject: `[AI-IDS CELL] Membership Request for cell: ${groupName}`,
    html
  });
};

/**
 * Format and send Invitation email
 */
const sendInviteEmail = async (inviteeEmail, inviterName, groupName) => {
  const html = `
    <div style="font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; color: #f3f4f6; padding: 40px 20px; text-align: center;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 32px; text-align: left; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px;">
          <div style="padding: 10px; background-color: rgba(99, 102, 241, 0.1); border: 1px solid #6366f140; border-radius: 8px; color: #6366f1; font-weight: bold; font-size: 18px; line-height: 1;">
            ✉️
          </div>
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.025em; color: #f3f4f6;">CELL INVITATION RECEIVED</h2>
            <span style="font-size: 9px; color: #818cf8; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">AI-HIDS Cell Invites</span>
          </div>
        </div>

        <p style="font-size: 13px; color: #e5e7eb; line-height: 1.6; margin-bottom: 20px;">
          Hello,
        </p>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin-bottom: 20px;">
          You have been invited by <strong>${inviterName}</strong> to join the collaborative security cell <strong>${groupName}</strong>.
        </p>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin-bottom: 24px;">
          Log into the HIDS dashboard to accept or decline the invitation and sync threat metrics.
        </p>

        <p style="font-size: 11px; color: #6b7280; line-height: 1.5; margin: 0; text-align: center;">
          This is an automated cell management notification.
        </p>

      </div>
    </div>
  `;

  return sendEmail({
    to: inviteeEmail,
    subject: `[AI-IDS CELL] Invitation to join cell: ${groupName}`,
    html
  });
};

module.exports = {
  sendEmail,
  sendAlertEmail,
  sendJoinRequestEmail,
  sendInviteEmail
};
