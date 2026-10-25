const nodemailer = require('nodemailer');

let transport;
const getTransport = () => {
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  return transport;
};

// Called through the module object so tests can replace it
const mailer = {
  // Without SMTP_URL, development prints codes to the log; production can't send them
  canSend() {
    return Boolean(process.env.SMTP_URL) || process.env.NODE_ENV !== 'production';
  },

  async sendPasswordResetCode(email, code) {
    if (!process.env.SMTP_URL) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SMTP_URL is not set, cannot send password reset email');
      }
      console.log(`Password reset code for ${email}: ${code} (SMTP_URL not set, so not emailed)`);
      return;
    }

    await getTransport().sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Your GeoSpot password reset code',
      text: `Your GeoSpot password reset code is ${code}. It expires in 15 minutes.`,
    });
  },
};

module.exports = mailer;
