const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

const router = express.Router();

// Configure multer for payment receipt uploads
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
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image and PDF files are allowed'));
  },
});

// Get payment summary for a project
router.get('/project/:projectId/summary', authenticateToken, (req, res) => {
  const projectId = req.params.projectId;
  const userId = req.user.userId;

  // Check access
  db.get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get all project members
      db.all(
        `SELECT u.id, u.email, u.profile_image, u.default_currency
         FROM project_members pm
         INNER JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = ?`,
        [projectId],
        (err, members) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Calculate total paid by each user
          db.all(
            `SELECT created_by as user_id, SUM(amount) as total_paid
             FROM expenses
             WHERE project_id = ?
             GROUP BY created_by`,
            [projectId],
            (err, paidTotals) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              // Calculate total owed by each user
              db.all(
                `SELECT es.user_id, SUM(es.amount) as total_owed
                 FROM expense_splits es
                 INNER JOIN expenses e ON es.expense_id = e.id
                 WHERE e.project_id = ?
                 GROUP BY es.user_id`,
                [projectId],
                (err, owedTotals) => {
                  if (err) {
                    return res.status(500).json({ error: 'Database error' });
                  }

                  // Calculate confirmed payments
                  db.all(
                    `SELECT from_user_id, to_user_id, SUM(amount) as total_paid
                     FROM payment_transactions
                     WHERE project_id = ? AND status = 'confirmed'
                     GROUP BY from_user_id, to_user_id`,
                    [projectId],
                    (err, confirmedPayments) => {
                      if (err) {
                        return res.status(500).json({ error: 'Database error' });
                      }

                      // Build summary
                      const paidMap = {};
                      paidTotals.forEach(p => {
                        paidMap[p.user_id] = parseFloat(p.total_paid || 0);
                      });

                      const owedMap = {};
                      owedTotals.forEach(o => {
                        owedMap[o.user_id] = parseFloat(o.total_owed || 0);
                      });

                      const paymentMap = {};
                      confirmedPayments.forEach(p => {
                        const key = `${p.from_user_id}_${p.to_user_id}`;
                        paymentMap[key] = parseFloat(p.total_paid || 0);
                      });

                      const summary = members.map(member => {
                        const paid = paidMap[member.id] || 0;
                        const owed = owedMap[member.id] || 0;
                        const net = paid - owed;

                        // Calculate receivables
                        const receivables = [];
                        members.forEach(otherMember => {
                          if (otherMember.id !== member.id) {
                            const key = `${otherMember.id}_${member.id}`;
                            const received = paymentMap[key] || 0;
                            const key2 = `${member.id}_${otherMember.id}`;
                            const sent = paymentMap[key2] || 0;

                            // Calculate what this member should receive from other member
                            // This is simplified - in reality, we need to track individual expense splits
                            const shouldReceive = 0; // This would need more complex calculation
                            if (shouldReceive > received) {
                              receivables.push({
                                from_user: otherMember,
                                amount: shouldReceive - received,
                              });
                            }
                          }
                        });

                        return {
                          user: member,
                          total_paid: parseFloat(paid.toFixed(2)),
                          total_owed: parseFloat(owed.toFixed(2)),
                          net: parseFloat(net.toFixed(2)),
                          receivables,
                        };
                      });

                      res.json(summary);
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

// Get receivables for a project
router.get('/project/:projectId/receivables', authenticateToken, (req, res) => {
  const projectId = req.params.projectId;
  const userId = req.user.userId;

  // Check access
  db.get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get all expenses and splits
      db.all(
        `SELECT e.id, e.amount, e.currency, es.user_id, es.amount as split_amount
         FROM expenses e
         INNER JOIN expense_splits es ON e.id = es.expense_id
         WHERE e.project_id = ?`,
        [projectId],
        (err, expenseSplits) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Get confirmed payments
          db.all(
            `SELECT from_user_id, to_user_id, SUM(amount) as total_paid
             FROM payment_transactions
             WHERE project_id = ? AND status = 'confirmed'
             GROUP BY from_user_id, to_user_id`,
            [projectId],
            (err, payments) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              // Calculate who owes what to whom
              const debtMap = {}; // key: "from_user_id_to_user_id", value: amount

              expenseSplits.forEach(expense => {
                db.get('SELECT created_by FROM expenses WHERE id = ?', [expense.id], (err, exp) => {
                  // This is a simplified calculation
                  // In reality, we need to track: if user A paid expense X, and user B owes Y from expense X, then B owes A
                });
              });

              // For now, return simplified receivables
              res.json({ receivables: [] });
            }
          );
        }
      );
    }
  );
});

// Make payment
router.post('/', authenticateToken, upload.single('receipt'), (req, res) => {
  const userId = req.user.userId;
  const { project_id, to_user_id, amount, details } = req.body;

  if (!project_id || !to_user_id || !amount) {
    return res.status(400).json({ error: 'Project ID, recipient user ID, and amount are required' });
  }

  // Check if both users are project members
  db.all(
    'SELECT user_id FROM project_members WHERE project_id = ? AND user_id IN (?, ?)',
    [project_id, userId, to_user_id],
    (err, members) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (members.length !== 2) {
        return res.status(400).json({ error: 'Both users must be project members' });
      }

      const paymentId = uuidv4();
      const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;
      const paymentAmount = parseFloat(amount).toFixed(2);

      db.run(
        `INSERT INTO payment_transactions (id, project_id, from_user_id, to_user_id, amount, status, details, receipt_path)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [paymentId, project_id, userId, to_user_id, paymentAmount, details || null, receiptPath],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to create payment' });
          }

          db.get('SELECT * FROM payment_transactions WHERE id = ?', [paymentId], (err, payment) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            res.status(201).json(payment);
          });
        }
      );
    }
  );
});

// Get payment transactions for a project
router.get('/project/:projectId/transactions', authenticateToken, (req, res) => {
  const projectId = req.params.projectId;
  const userId = req.user.userId;

  // Check access
  db.get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member) {
        return res.status(403).json({ error: 'Access denied' });
      }

      db.all(
        `SELECT pt.*,
         u1.email as from_user_email, u1.profile_image as from_user_image,
         u2.email as to_user_email, u2.profile_image as to_user_image
         FROM payment_transactions pt
         INNER JOIN users u1 ON pt.from_user_id = u1.id
         INNER JOIN users u2 ON pt.to_user_id = u2.id
         WHERE pt.project_id = ?
         ORDER BY pt.created_at DESC`,
        [projectId],
        (err, transactions) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          res.json(transactions);
        }
      );
    }
  );
});

// Update payment status (accept/reject)
router.put('/:id/status', authenticateToken, (req, res) => {
  const paymentId = req.params.id;
  const userId = req.user.userId;
  const { status } = req.body;

  if (!['confirmed', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be confirmed or rejected' });
  }

  // Check if user is the recipient
  db.get('SELECT to_user_id FROM payment_transactions WHERE id = ?', [paymentId], (err, payment) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.to_user_id !== userId) {
      return res.status(403).json({ error: 'Only the recipient can update payment status' });
    }

    db.run(
      'UPDATE payment_transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, paymentId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update payment status' });
        }

        db.get('SELECT * FROM payment_transactions WHERE id = ?', [paymentId], (err, updatedPayment) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          res.json(updatedPayment);
        });
      }
    );
  });
});

module.exports = router;

