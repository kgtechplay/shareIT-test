const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  },
});

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  db.get('SELECT id, email, mobile, profile_image, default_currency FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

// Update user profile
router.put('/me', authenticateToken, upload.single('profile_image'), (req, res) => {
  const { mobile, default_currency } = req.body;
  const userId = req.user.userId;

  let profileImage = null;
  if (req.file) {
    profileImage = `/uploads/${req.file.filename}`;
  }

  const updates = [];
  const values = [];

  if (mobile !== undefined) {
    updates.push('mobile = ?');
    values.push(mobile);
  }
  if (default_currency !== undefined) {
    updates.push('default_currency = ?');
    values.push(default_currency);
  }
  if (profileImage) {
    // Get old image path to delete it
    db.get('SELECT profile_image FROM users WHERE id = ?', [userId], (err, user) => {
      if (user && user.profile_image) {
        const oldImagePath = path.join(__dirname, '../../', user.profile_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    });

    updates.push('profile_image = ?');
    values.push(profileImage);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

  db.run(query, values, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    db.get('SELECT id, email, mobile, profile_image, default_currency FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(user);
    });
  });
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    db.get('SELECT password FROM users WHERE id = ?', [req.user.userId], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const validPassword = await bcrypt.compare(current_password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);

      db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, req.user.userId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update password' });
        }

        res.json({ message: 'Password updated successfully' });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users by email
router.get('/search', authenticateToken, (req, res) => {
  const { email } = req.query;

  if (!email || email.length < 2) {
    return res.status(400).json({ error: 'Email query must be at least 2 characters' });
  }

  db.all(
    'SELECT id, email, mobile, profile_image, default_currency FROM users WHERE email LIKE ? AND id != ? LIMIT 10',
    [`%${email}%`, req.user.userId],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(users);
    }
  );
});

module.exports = router;

