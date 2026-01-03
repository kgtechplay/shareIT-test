const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

const router = express.Router();

// Configure multer for receipt uploads
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
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
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

// Get all expenses for a project
router.get('/project/:projectId', authenticateToken, (req, res) => {
  const projectId = req.params.projectId;
  const userId = req.user.userId;

  // Check if user has access to project
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
        `SELECT e.*, 
         u.email as created_by_email,
         u.profile_image as created_by_image
         FROM expenses e
         INNER JOIN users u ON e.created_by = u.id
         WHERE e.project_id = ?
         ORDER BY e.date DESC, e.created_at DESC`,
        [projectId],
        (err, expenses) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Get splits for each expense
          const expenseIds = expenses.map(e => e.id);
          if (expenseIds.length === 0) {
            return res.json([]);
          }

          const placeholders = expenseIds.map(() => '?').join(',');
          db.all(
            `SELECT es.*, u.email as user_email, u.profile_image as user_image
             FROM expense_splits es
             INNER JOIN users u ON es.user_id = u.id
             WHERE es.expense_id IN (${placeholders})`,
            expenseIds,
            (err, splits) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              // Group splits by expense
              const splitsByExpense = {};
              splits.forEach(split => {
                if (!splitsByExpense[split.expense_id]) {
                  splitsByExpense[split.expense_id] = [];
                }
                splitsByExpense[split.expense_id].push(split);
              });

              // Attach splits to expenses
              const expensesWithSplits = expenses.map(expense => ({
                ...expense,
                splits: splitsByExpense[expense.id] || [],
              }));

              res.json(expensesWithSplits);
            }
          );
        }
      );
    }
  );
});

// Create expense
router.post('/', authenticateToken, upload.single('receipt'), (req, res) => {
  const userId = req.user.userId;
  const {
    project_id,
    name,
    description,
    amount,
    currency,
    date,
    paid_to,
    payment_mode,
    splits, // Array of {user_id, amount, percentage}
  } = req.body;

  if (!project_id || !name || !amount || !splits) {
    return res.status(400).json({ error: 'Project ID, name, amount, and splits are required' });
  }

  // Check if user is editor or owner
  db.get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [project_id, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member || (member.role !== 'owner' && member.role !== 'editor')) {
        return res.status(403).json({ error: 'Only editors and owners can add expenses' });
      }

      // Get project default currency
      db.get('SELECT default_currency FROM projects WHERE id = ?', [project_id], (err, project) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const expenseCurrency = currency || project.default_currency || 'USD';
        const expenseAmount = parseFloat(amount);
        const expenseDate = date || new Date().toISOString().split('T')[0];

        // Validate splits
        const splitsArray = JSON.parse(splits);
        let totalAmount = 0;
        let totalPercentage = 0;

        splitsArray.forEach(split => {
          if (split.amount !== undefined && split.amount !== null) {
            totalAmount += parseFloat(split.amount);
          }
          if (split.percentage !== undefined && split.percentage !== null) {
            totalPercentage += parseFloat(split.percentage);
          }
        });

        // Validate split totals
        if (totalAmount > 0 && Math.abs(totalAmount - expenseAmount) > 0.01) {
          return res.status(400).json({ error: 'Sum of split amounts must equal expense amount' });
        }

        if (totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.01) {
          return res.status(400).json({ error: 'Sum of split percentages must equal 100%' });
        }

        // Calculate amounts from percentages if needed
        const finalSplits = splitsArray.map(split => {
          if (split.percentage !== undefined && split.percentage !== null && split.amount === undefined) {
            return {
              ...split,
              amount: parseFloat((expenseAmount * parseFloat(split.percentage) / 100).toFixed(2)),
            };
          }
          return split;
        });

        const expenseId = uuidv4();
        const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;

        // Create expense
        db.run(
          `INSERT INTO expenses (id, project_id, name, description, amount, currency, date, paid_to, payment_mode, receipt_path, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [expenseId, project_id, name, description || null, expenseAmount, expenseCurrency, expenseDate, paid_to || null, payment_mode || null, receiptPath, userId],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to create expense' });
            }

            // Create splits
            const splitPromises = finalSplits.map(split => {
              return new Promise((resolve, reject) => {
                const splitId = uuidv4();
                const splitAmount = parseFloat(split.amount).toFixed(2);
                const splitPercentage = split.percentage ? parseFloat(split.percentage).toFixed(2) : null;

                db.run(
                  'INSERT INTO expense_splits (id, expense_id, user_id, amount, percentage) VALUES (?, ?, ?, ?, ?)',
                  [splitId, expenseId, split.user_id, splitAmount, splitPercentage],
                  (err) => {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
            });

            Promise.all(splitPromises)
              .then(() => {
                db.get('SELECT * FROM expenses WHERE id = ?', [expenseId], (err, expense) => {
                  if (err) {
                    return res.status(500).json({ error: 'Database error' });
                  }

                  // Get splits
                  db.all(
                    `SELECT es.*, u.email as user_email, u.profile_image as user_image
                     FROM expense_splits es
                     INNER JOIN users u ON es.user_id = u.id
                     WHERE es.expense_id = ?`,
                    [expenseId],
                    (err, expenseSplits) => {
                      if (err) {
                        return res.status(500).json({ error: 'Database error' });
                      }

                      res.status(201).json({
                        ...expense,
                        splits: expenseSplits,
                      });
                    }
                  );
                });
              })
              .catch(err => {
                res.status(500).json({ error: 'Failed to create expense splits' });
              });
          }
        );
      });
    }
  );
});

// Update expense
router.put('/:id', authenticateToken, upload.single('receipt'), (req, res) => {
  const expenseId = req.params.id;
  const userId = req.user.userId;
  const {
    name,
    description,
    amount,
    currency,
    date,
    paid_to,
    payment_mode,
    splits,
  } = req.body;

  // Check if user created the expense or is owner/editor
  db.get('SELECT project_id, created_by FROM expenses WHERE id = ?', [expenseId], (err, expense) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Check access
    db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [expense.project_id, userId],
      (err, member) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!member || (member.role !== 'owner' && member.role !== 'editor' && expense.created_by !== userId)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const updates = [];
        const values = [];

        if (name !== undefined) updates.push('name = ?'), values.push(name);
        if (description !== undefined) updates.push('description = ?'), values.push(description || null);
        if (amount !== undefined) updates.push('amount = ?'), values.push(parseFloat(amount));
        if (currency !== undefined) updates.push('currency = ?'), values.push(currency);
        if (date !== undefined) updates.push('date = ?'), values.push(date);
        if (paid_to !== undefined) updates.push('paid_to = ?'), values.push(paid_to || null);
        if (payment_mode !== undefined) updates.push('payment_mode = ?'), values.push(payment_mode || null);

        if (req.file) {
          // Delete old receipt
          db.get('SELECT receipt_path FROM expenses WHERE id = ?', [expenseId], (err, oldExpense) => {
            if (oldExpense && oldExpense.receipt_path) {
              const oldPath = path.join(__dirname, '../../', oldExpense.receipt_path);
              if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
              }
            }
          });

          updates.push('receipt_path = ?');
          values.push(`/uploads/${req.file.filename}`);
        }

        if (updates.length === 0 && !splits) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        if (updates.length > 0) {
          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(expenseId);

          const query = `UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`;
          db.run(query, values, (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to update expense' });
            }
            updateExpenseSplits();
          });
        } else {
          updateExpenseSplits();
        }

        function updateExpenseSplits() {
          if (splits) {
            const splitsArray = JSON.parse(splits);
            const expenseAmount = parseFloat(amount || expense.amount);

            // Validate splits
            let totalAmount = 0;
            let totalPercentage = 0;

            splitsArray.forEach(split => {
              if (split.amount !== undefined) totalAmount += parseFloat(split.amount);
              if (split.percentage !== undefined) totalPercentage += parseFloat(split.percentage);
            });

            if (totalAmount > 0 && Math.abs(totalAmount - expenseAmount) > 0.01) {
              return res.status(400).json({ error: 'Sum of split amounts must equal expense amount' });
            }

            if (totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.01) {
              return res.status(400).json({ error: 'Sum of split percentages must equal 100%' });
            }

            // Delete old splits
            db.run('DELETE FROM expense_splits WHERE expense_id = ?', [expenseId], (err) => {
              if (err) {
                return res.status(500).json({ error: 'Failed to update splits' });
              }

              // Create new splits
              const finalSplits = splitsArray.map(split => {
                if (split.percentage !== undefined && split.amount === undefined) {
                  return {
                    ...split,
                    amount: parseFloat((expenseAmount * parseFloat(split.percentage) / 100).toFixed(2)),
                  };
                }
                return split;
              });

              const splitPromises = finalSplits.map(split => {
                return new Promise((resolve, reject) => {
                  const splitId = uuidv4();
                  db.run(
                    'INSERT INTO expense_splits (id, expense_id, user_id, amount, percentage) VALUES (?, ?, ?, ?, ?)',
                    [splitId, expenseId, split.user_id, parseFloat(split.amount).toFixed(2), split.percentage ? parseFloat(split.percentage).toFixed(2) : null],
                    (err) => {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                });
              });

              Promise.all(splitPromises)
                .then(() => {
                  sendResponse();
                })
                .catch(err => {
                  res.status(500).json({ error: 'Failed to update expense splits' });
                });
            });
          } else {
            sendResponse();
          }
        }

        function sendResponse() {
          db.get('SELECT * FROM expenses WHERE id = ?', [expenseId], (err, updatedExpense) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            db.all(
              `SELECT es.*, u.email as user_email, u.profile_image as user_image
               FROM expense_splits es
               INNER JOIN users u ON es.user_id = u.id
               WHERE es.expense_id = ?`,
              [expenseId],
              (err, expenseSplits) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error' });
                }

                res.json({
                  ...updatedExpense,
                  splits: expenseSplits,
                });
              }
            );
          });
        }
      });
    });
  });
});

// Delete expense
router.delete('/:id', authenticateToken, (req, res) => {
  const expenseId = req.params.id;
  const userId = req.user.userId;

  db.get('SELECT project_id, created_by, receipt_path FROM expenses WHERE id = ?', [expenseId], (err, expense) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Check access
    db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [expense.project_id, userId],
      (err, member) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!member || (member.role !== 'owner' && member.role !== 'editor' && expense.created_by !== userId)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Delete receipt file
        if (expense.receipt_path) {
          const receiptPath = path.join(__dirname, '../../', expense.receipt_path);
          if (fs.existsSync(receiptPath)) {
            fs.unlinkSync(receiptPath);
          }
        }

        // Delete expense (splits will be deleted by CASCADE)
        db.run('DELETE FROM expenses WHERE id = ?', [expenseId], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to delete expense' });
          }

          res.json({ message: 'Expense deleted successfully' });
        });
      }
    );
  });
});

module.exports = router;

