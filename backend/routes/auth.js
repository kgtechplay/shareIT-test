const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { generateRandomPassword, sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already exists
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (user) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Generate random password
      const password = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      // Create user
      db.run(
        'INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
        [userId, email, hashedPassword],
        async (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to create user' });
          }

          // Send welcome email
          await sendWelcomeEmail(email, password);

          res.status(201).json({
            message: 'User created successfully. Check your email for the password.',
            userId,
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          mobile: user.mobile,
          profile_image: user.profile_image,
          default_currency: user.default_currency,
        },
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({ message: 'If the email exists, a password reset email has been sent.' });
      }

      // Generate new random password
      const newPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id], async (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to reset password' });
        }

        // Send password reset email
        await sendPasswordResetEmail(email, newPassword);

        res.json({ message: 'If the email exists, a password reset email has been sent.' });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

