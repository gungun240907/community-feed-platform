const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendSubscriptionConfirmation(user, subscription, payment) {
  const transport = getTransporter();
  if (!transport) {
    console.log('Email service not configured. Skipping confirmation email.');
    console.log(`Subscription activated for ${user.email}: ${subscription.plan} plan`);
    return;
  }

  const planLabel = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1);

  try {
    await transport.sendMail({
      from: `"DevFeed" <${process.env.SMTP_FROM || 'noreply@devfeed.com'}>`,
      to: user.email,
      subject: `Welcome to DevFeed ${planLabel}! Your subscription is active`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to DevFeed ${planLabel}!</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">Your subscription is now active</p>
          </div>
          <div style="padding: 32px; background: #fff; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; font-size: 18px;">Subscription Details</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Plan</td>
                <td style="padding: 8px 0; font-weight: 600; color: #1f2937;">${planLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Amount</td>
                <td style="padding: 8px 0; font-weight: 600; color: #1f2937;">₹${(payment?.amount || subscription.plan === 'bronze' ? 99 : subscription.plan === 'silver' ? 299 : 999)}/month</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Status</td>
                <td style="padding: 8px 0; font-weight: 600; color: #059669;">Active</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Renewal Date</td>
                <td style="padding: 8px 0; font-weight: 600; color: #1f2937;">${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}</td>
              </tr>
            </table>
              ${payment?.invoiceNumber ? `
              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <h3 style="color: #1f2937; font-size: 16px;">Invoice</h3>
                <p style="color: #4b5563; font-size: 14px;">Invoice #: <strong>${payment.invoiceNumber}</strong></p>
                <p style="color: #4b5563; font-size: 14px; margin-top: 8px;"><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription" style="color: #6366f1; font-weight: 600;">Download invoice from your dashboard</a></p>
              </div>
              ` : `
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
              <h3 style="color: #1f2937; font-size: 16px;">Invoice</h3>
              <p style="color: #4b5563; font-size: 14px;">Your invoice has been generated and is available in your subscription dashboard.</p>
            </div>
            `}
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
              <h3 style="color: #1f2937; font-size: 16px;">Plan Features</h3>
              <ul style="color: #4b5563; line-height: 1.8; padding-left: 20px;">
                ${subscription.plan === 'bronze' ? `
                <li>5 questions per day</li>
                <li>Bronze profile badge</li>
                <li>Advanced search filters</li>
                ` : subscription.plan === 'silver' ? `
                <li>15 questions per day</li>
                <li>Silver profile badge</li>
                <li>Advanced search filters</li>
                <li>Priority support</li>
                <li>Enhanced profile visibility</li>
                <li>Unlimited bookmarks</li>
                ` : `
                <li>Unlimited questions</li>
                <li>Gold profile badge</li>
                <li>Highest search priority</li>
                <li>Featured profile visibility</li>
                <li>Priority customer support</li>
                <li>Exclusive community features</li>
                `}
              </ul>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
              DevFeed Community Platform &mdash; Where developers share, learn, and grow together.
            </p>
          </div>
        </div>
      `,
    });
    console.log(`Confirmation email sent to ${user.email}`);
  } catch (err) {
    console.error('Failed to send confirmation email:', err.message);
  }
}

async function sendSupportEmail({ user, subject, category, message, isPriority }) {
  const transport = getTransporter();
  const tag = isPriority ? '[PRIORITY]' : '[STANDARD]';

  if (!transport) {
    console.log(`Email service not configured. Skipping support email.`);
    console.log(`${tag} Support ticket from ${user.email}: ${subject}`);
    return;
  }

  try {
    await transport.sendMail({
      from: `"DevFeed Support" <${process.env.SMTP_FROM || 'noreply@devfeed.com'}>`,
      to: process.env.SUPPORT_EMAIL || 'support@devfeed.com',
      subject: `${tag} [${category.toUpperCase()}] ${subject}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${isPriority ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #6366f1, #a855f7)'}; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">${tag} Support Ticket</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 6px;">${isPriority ? 'Priority support request' : 'Standard support request'}</p>
          </div>
          <div style="padding: 32px; background: #fff; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">From</td><td style="padding: 6px 0; font-weight: 600; color: #1f2937; font-size: 14px;">${user.displayName || user.username} (${user.email})</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Plan</td><td style="padding: 6px 0; font-weight: 600; color: #1f2937; font-size: 14px; text-transform: capitalize;">${user.subscriptionPlan || 'free'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Category</td><td style="padding: 6px 0; font-weight: 600; color: #1f2937; font-size: 14px; text-transform: capitalize;">${category}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Subject</td><td style="padding: 6px 0; font-weight: 600; color: #1f2937; font-size: 14px;">${subject}</td></tr>
            </table>
            <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`Support email sent: ${tag} ${subject}`);
  } catch (err) {
    console.error('Failed to send support email:', err.message);
  }
}

async function sendNewDeviceLoginAlert(user, deviceInfo) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`Email service not configured. New device login alert for ${user.email}:`, deviceInfo);
    return;
  }

  const deviceTypeLabel = deviceInfo.deviceType ? deviceInfo.deviceType.charAt(0).toUpperCase() + deviceInfo.deviceType.slice(1) : 'Unknown';

  try {
    await transport.sendMail({
      from: `"DevFeed Security" <${process.env.SMTP_FROM || 'noreply@devfeed.com'}>`,
      to: user.email,
      subject: 'New device logged into your DevFeed account',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">New Device Login</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 6px;">A new device just logged into your account</p>
          </div>
          <div style="padding: 32px; background: #fff; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              Hi <strong>${user.displayName || user.username}</strong>,
            </p>
            <p style="color: #374151; font-size: 14px; line-height: 1.6;">
              A new device was used to log into your DevFeed account. If this was you, you can ignore this email. If not, please revoke the session from your account settings.
            </p>
            <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h3 style="color: #1f2937; font-size: 15px; margin: 0 0 12px 0;">Device Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 5px 0; color: #6b7280; font-size: 13px;">Device Type</td><td style="padding: 5px 0; font-weight: 600; color: #1f2937; font-size: 13px;">${deviceTypeLabel}</td></tr>
                <tr><td style="padding: 5px 0; color: #6b7280; font-size: 13px;">Browser</td><td style="padding: 5px 0; font-weight: 600; color: #1f2937; font-size: 13px;">${deviceInfo.browser}</td></tr>
                <tr><td style="padding: 5px 0; color: #6b7280; font-size: 13px;">Operating System</td><td style="padding: 5px 0; font-weight: 600; color: #1f2937; font-size: 13px;">${deviceInfo.os}</td></tr>
                <tr><td style="padding: 5px 0; color: #6b7280; font-size: 13px;">IP Address</td><td style="padding: 5px 0; font-weight: 600; color: #1f2937; font-size: 13px;">${deviceInfo.ip || 'Unknown'}</td></tr>
                ${deviceInfo.location ? `<tr><td style="padding: 5px 0; color: #6b7280; font-size: 13px;">Location</td><td style="padding: 5px 0; font-weight: 600; color: #1f2937; font-size: 13px;">${deviceInfo.location}</td></tr>` : ''}
              </table>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
              DevFeed Community Platform &mdash; Keeping your account secure.
            </p>
          </div>
        </div>
      `,
    });
    console.log(`New device login alert sent to ${user.email}`);
  } catch (err) {
    console.error('Failed to send new device login alert:', err.message);
  }
}

async function sendOtpEmail({ user, otp, purpose }) {
  const transport = getTransporter();
  if (!transport) {
    console.log('Email service not configured. Skipping OTP email.');
    console.log(`OTP for ${user.email} (${purpose}): ${otp}`);
    return false;
  }

  const purposeLabel = {
    login_verification: 'login verification',
    language_switch: 'language change',
    email_verification: 'email verification',
    phone_verification: 'phone verification',
    password_reset: 'password reset',
  }[purpose] || purpose;

  try {
    await transport.sendMail({
      from: `"DevFeed Security" <${process.env.SMTP_FROM || 'noreply@devfeed.com'}>`,
      to: user.email,
      subject: `Your ${purposeLabel} code for DevFeed`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; text-align: center;">
          <h2 style="color: #1f2937;">${purposeLabel === 'language change' ? 'Language Change' : 'Verification'} Code</h2>
          <p style="color: #6b7280;">Use the code below to continue. It expires in 10 minutes.</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 16px 0;">${otp}</div>
          <p style="color: #9ca3af; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    console.log(`OTP email sent to ${user.email} for ${purpose}`);
    return true;
  } catch (err) {
    console.error('Failed to send OTP email:', err.message);
    return false;
  }
}

async function sendPasswordResetEmail(user, newPassword) {
  const transport = getTransporter();
  if (!transport) {
    console.log('Email service not configured. Skipping password reset email.');
    console.log(`New password for ${user.email}: ${newPassword}`);
    return false;
  }

  try {
    await transport.sendMail({
      from: `"DevFeed Security" <${process.env.SMTP_FROM || 'noreply@devfeed.com'}>`,
      to: user.email,
      subject: 'Your DevFeed password has been reset',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; text-align: center;">
          <h2 style="color: #1f2937;">Password Reset</h2>
          <p style="color: #6b7280;">Your password has been reset as requested. Use the temporary password below to sign in, then change it from your profile.</p>
          <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #f3f4f6; padding: 16px; border-radius: 12px; margin: 16px 0;">${newPassword}</div>
          <p style="color: #9ca3af; font-size: 12px;">For your security, this password is shown only in this email. If you didn't request a reset, please contact support immediately.</p>
        </div>
      `,
    });
    console.log(`Password reset email sent to ${user.email}`);
    return true;
  } catch (err) {
    console.error('Failed to send password reset email:', err.message);
    return false;
  }
}

module.exports = { sendSubscriptionConfirmation, sendSupportEmail, sendNewDeviceLoginAlert, sendOtpEmail, sendPasswordResetEmail };