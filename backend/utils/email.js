const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to, subject, text, html) {
  try {
    const info = await transporter.sendMail({
      from: `"ShareIT" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

function generateRandomPassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function sendWelcomeEmail(email, password) {
  const subject = 'Welcome to ShareIT - Your Account Details';
  const text = `Welcome to ShareIT!\n\nYour account has been created.\n\nEmail: ${email}\nPassword: ${password}\n\nPlease login and change your password from your profile.\n\nBest regards,\nShareIT Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to ShareIT!</h2>
      <p>Your account has been created successfully.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p>Please login and change your password from your profile settings.</p>
      <p>Best regards,<br>ShareIT Team</p>
    </div>
  `;
  return await sendEmail(email, subject, text, html);
}

async function sendPasswordResetEmail(email, password) {
  const subject = 'ShareIT - Password Reset';
  const text = `Your password has been reset.\n\nEmail: ${email}\nNew Password: ${password}\n\nPlease login and change your password from your profile.\n\nBest regards,\nShareIT Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset</h2>
      <p>Your password has been reset.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>New Password:</strong> ${password}</p>
      <p>Please login and change your password from your profile settings.</p>
      <p>Best regards,<br>ShareIT Team</p>
    </div>
  `;
  return await sendEmail(email, subject, text, html);
}

module.exports = {
  sendEmail,
  generateRandomPassword,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};

