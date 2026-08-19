import nodemailer from "nodemailer";

/**
 * Send intake form email to client.
 * Uses Gmail via keyless delegation.
 */
export async function sendIntakeFormEmail(
  clientEmail: string,
  clientName: string,
  intakeFormUrl: string
): Promise<void> {
  // In production, use Gmail API with service account delegation
  // For now, this is a placeholder — configure SMTP or Gmail API
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.MAIL_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const htmlContent = `
    <html>
      <body>
        <h2>Welcome to TAG Success Hub, ${clientName}!</h2>
        <p>We're excited to work with you. To get started, please complete our quick intake form:</p>

        <p>
          <a href="${intakeFormUrl}" style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #0066cc;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
          ">Complete Intake Form</a>
        </p>

        <p>Once you submit the form, we'll provision your resources and send next steps.</p>
        <p>If you have any questions, reply to this email.</p>

        <p>— TAG Success Team</p>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || "noreply@taxadvisorygrowth.com",
    to: clientEmail,
    subject: "Complete Your TAG Success Hub Onboarding",
    html: htmlContent,
  });
}

/**
 * Send provisioning confirmation email to TAG team.
 */
export async function sendProvisioningConfirmation(data: {
  clientName: string;
  clientEmail: string;
  locationId: string;
  slackChannelId: string;
  driveFolderId: string;
  opportunityId: string;
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.MAIL_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const htmlContent = `
    <html>
      <body>
        <h2>Client Provisioning Complete</h2>
        <p><strong>Client:</strong> ${data.clientName}</p>
        <p><strong>Email:</strong> ${data.clientEmail}</p>

        <h3>Resources Created:</h3>
        <ul>
          <li><strong>GHL Location ID:</strong> ${data.locationId}</li>
          <li><strong>Slack Channel:</strong> #${data.slackChannelId}</li>
          <li><strong>Drive Folder:</strong> ${data.driveFolderId}</li>
          <li><strong>Fulfillment Opportunity:</strong> ${data.opportunityId}</li>
        </ul>

        <p>Intake form has been sent to the client. Monitor for submission.</p>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || "noreply@taxadvisorygrowth.com",
    to: process.env.TAG_TEAM_EMAIL || "team@taxadvisorygrowth.com",
    subject: `New Client Provisioned: ${data.clientName}`,
    html: htmlContent,
  });
}

/**
 * Send Meta ad account access request to client.
 * Guides them to grant system user access to their Meta ad account.
 */
export async function sendMetaAccessRequest(
  clientEmail: string,
  data: {
    clientName: string;
    metaAdAccountId: string;
    tagAccessEmail: string;
    instructions: string;
  }
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.MAIL_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const htmlContent = `
    <html>
      <body>
        <h2>Next Step: Grant Meta Ad Account Access</h2>
        <p>Hi ${data.clientName},</p>

        <p>We found that you have a Meta ad account (${data.metaAdAccountId}). To complete your setup, we need access to manage and optimize your campaigns.</p>

        <h3>How to Grant Access:</h3>
        <ol>
          <li>Go to <a href="https://business.facebook.com">business.facebook.com</a></li>
          <li>Click Business Settings → Users → People → Add</li>
          <li>Add <strong>${data.tagAccessEmail}</strong> as a Business Manager Admin (not just access to one ad account — full Business Manager Admin)</li>
          <li>Reply to this email confirming access is granted</li>
        </ol>

        <p>Once you grant access, we handle the rest ourselves — no further action needed on your end. We'll configure your account for campaign optimization and reporting.</p>

        <p>Have questions? Reply to this email.</p>
        <p>— TAG Success Team</p>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || "noreply@taxadvisorygrowth.com",
    to: clientEmail,
    subject: `Action Needed: Grant Meta Ad Account Access`,
    html: htmlContent,
  });
}

/**
 * Send Meta ad account setup guide to client (for new accounts).
 */
export async function sendMetaSetupGuide(
  clientEmail: string,
  data: {
    clientName: string;
    setupUrl: string;
    supportEmail: string;
  }
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.MAIL_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const htmlContent = `
    <html>
      <body>
        <h2>Create Your Meta Ad Account</h2>
        <p>Hi ${data.clientName},</p>

        <p>We're ready to launch your campaigns! First, we need you to set up a Meta ad account.</p>

        <h3>Steps:</h3>
        <ol>
          <li><a href="${data.setupUrl}">Create your Meta Ad Manager account</a></li>
          <li>Once created, reply to this email with your ad account ID</li>
          <li>We'll then request access and configure your account</li>
        </ol>

        <p><strong>Need help?</strong> Contact us at <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>

        <p>— TAG Success Team</p>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || "noreply@taxadvisorygrowth.com",
    to: clientEmail,
    subject: `Create Your Meta Ad Account`,
    html: htmlContent,
  });
}
