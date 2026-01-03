const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/db');

const router = express.Router();

// Get dashboard data
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { project_ids, user_ids, start_date, end_date } = req.query;

  // Get user's default currency
  db.get('SELECT default_currency FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const userCurrency = user.default_currency || 'USD';

    // Build query filters
    let expenseFilter = 'e.created_by = ? OR es.user_id = ?';
    let expenseParams = [userId, userId];

    if (project_ids) {
      const projectIds = project_ids.split(',');
      const placeholders = projectIds.map(() => '?').join(',');
      expenseFilter += ` AND e.project_id IN (${placeholders})`;
      expenseParams = expenseParams.concat(projectIds);
    }

    if (start_date) {
      expenseFilter += ' AND e.date >= ?';
      expenseParams.push(start_date);
    }

    if (end_date) {
      expenseFilter += ' AND e.date <= ?';
      expenseParams.push(end_date);
    }

    // Get total spent (expenses created by user)
    db.get(
      `SELECT COALESCE(SUM(e.amount), 0) as total_spent
       FROM expenses e
       WHERE e.created_by = ? ${project_ids ? `AND e.project_id IN (${project_ids.split(',').map(() => '?').join(',')})` : ''}
       ${start_date ? 'AND e.date >= ?' : ''}
       ${end_date ? 'AND e.date <= ?' : ''}`,
      [
        userId,
        ...(project_ids ? project_ids.split(',') : []),
        ...(start_date ? [start_date] : []),
        ...(end_date ? [end_date] : []),
      ],
      (err, spentResult) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Get total paid to others (confirmed payments sent)
        db.get(
          `SELECT COALESCE(SUM(pt.amount), 0) as total_paid
           FROM payment_transactions pt
           WHERE pt.from_user_id = ? AND pt.status = 'confirmed'
           ${project_ids ? `AND pt.project_id IN (${project_ids.split(',').map(() => '?').join(',')})` : ''}`,
          [userId, ...(project_ids ? project_ids.split(',') : [])],
          (err, paidResult) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            // Get total received (confirmed payments received)
            db.get(
              `SELECT COALESCE(SUM(pt.amount), 0) as total_received
               FROM payment_transactions pt
               WHERE pt.to_user_id = ? AND pt.status = 'confirmed'
               ${project_ids ? `AND pt.project_id IN (${project_ids.split(',').map(() => '?').join(',')})` : ''}`,
              [userId, ...(project_ids ? project_ids.split(',') : [])],
              (err, receivedResult) => {
                if (err) {
                  return res.status(500).json({ error: 'Database error' });
                }

                // Get expenses breakdown
                db.all(
                  `SELECT e.*, p.name as project_name
                   FROM expenses e
                   INNER JOIN projects p ON e.project_id = p.id
                   WHERE e.created_by = ?
                   ${project_ids ? `AND e.project_id IN (${project_ids.split(',').map(() => '?').join(',')})` : ''}
                   ${start_date ? 'AND e.date >= ?' : ''}
                   ${end_date ? 'AND e.date <= ?' : ''}
                   ORDER BY e.date DESC
                   LIMIT 50`,
                  [
                    userId,
                    ...(project_ids ? project_ids.split(',') : []),
                    ...(start_date ? [start_date] : []),
                    ...(end_date ? [end_date] : []),
                  ],
                  (err, expenses) => {
                    if (err) {
                      return res.status(500).json({ error: 'Database error' });
                    }

                    res.json({
                      currency: userCurrency,
                      total_spent: parseFloat(spentResult.total_spent || 0).toFixed(2),
                      total_paid_to_others: parseFloat(paidResult.total_paid || 0).toFixed(2),
                      total_received: parseFloat(receivedResult.total_received || 0).toFixed(2),
                      recent_expenses: expenses,
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

module.exports = router;

