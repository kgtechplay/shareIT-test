const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

const router = express.Router();

// Get all projects for current user
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  db.all(
    `SELECT p.*, pm.role 
     FROM projects p
     INNER JOIN project_members pm ON p.id = pm.project_id
     WHERE pm.user_id = ?
     ORDER BY p.created_at DESC`,
    [userId],
    (err, projects) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(projects);
    }
  );
});

// Get single project with members
router.get('/:id', authenticateToken, (req, res) => {
  const projectId = req.params.id;
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

      // Get project details
      db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, project) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Get project members
        db.all(
          `SELECT u.id, u.email, u.mobile, u.profile_image, u.default_currency, pm.role
           FROM project_members pm
           INNER JOIN users u ON pm.user_id = u.id
           WHERE pm.project_id = ?
           ORDER BY pm.created_at`,
          [projectId],
          (err, members) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            res.json({
              ...project,
              members,
              userRole: member.role,
            });
          }
        );
      });
    }
  );
});

// Create project
router.post('/', authenticateToken, (req, res) => {
  const { name, start_date, end_date, default_currency } = req.body;
  const userId = req.user.userId;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const projectId = uuidv4();
  const currency = default_currency || 'USD';

  db.run(
    'INSERT INTO projects (id, name, start_date, end_date, default_currency, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [projectId, name, start_date || null, end_date || null, currency, userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to create project' });
      }

      // Add creator as owner
      const memberId = uuidv4();
      db.run(
        'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
        [memberId, projectId, userId, 'owner'],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to add project owner' });
          }

          db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, project) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json(project);
          });
        }
      );
    }
  );
});

// Update project
router.put('/:id', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.userId;
  const { name, start_date, end_date, default_currency } = req.body;

  // Check if user is owner or editor
  db.get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member || (member.role !== 'owner' && member.role !== 'editor')) {
        return res.status(403).json({ error: 'Only owners and editors can update projects' });
      }

      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (start_date !== undefined) {
        updates.push('start_date = ?');
        values.push(start_date || null);
      }
      if (end_date !== undefined) {
        updates.push('end_date = ?');
        values.push(end_date || null);
      }
      if (default_currency !== undefined) {
        updates.push('default_currency = ?');
        values.push(default_currency);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(projectId);

      const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`;

      db.run(query, values, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update project' });
        }

        db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, project) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json(project);
        });
      });
    }
  );
});

// Add member to project
router.post('/:id/members', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.userId;
  const { user_id, role } = req.body;

  if (!user_id || !role) {
    return res.status(400).json({ error: 'User ID and role are required' });
  }

  if (!['editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be editor or viewer' });
  }

  // Check if current user is owner or editor
  db.get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member || (member.role !== 'owner' && member.role !== 'editor')) {
        return res.status(403).json({ error: 'Only owners and editors can add members' });
      }

      // Check if user exists
      db.get('SELECT id FROM users WHERE id = ?', [user_id], (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Check if user is already a member
        db.get(
          'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
          [projectId, user_id],
          (err, existing) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            if (existing) {
              return res.status(400).json({ error: 'User is already a member of this project' });
            }

            const memberId = uuidv4();
            db.run(
              'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
              [memberId, projectId, user_id, role],
              (err) => {
                if (err) {
                  return res.status(500).json({ error: 'Failed to add member' });
                }

                db.get(
                  `SELECT u.id, u.email, u.mobile, u.profile_image, u.default_currency, pm.role
                   FROM project_members pm
                   INNER JOIN users u ON pm.user_id = u.id
                   WHERE pm.id = ?`,
                  [memberId],
                  (err, newMember) => {
                    if (err) {
                      return res.status(500).json({ error: 'Database error' });
                    }
                    res.status(201).json(newMember);
                  }
                );
              }
            );
          }
        );
      });
    }
  );
});

// Remove member from project
router.delete('/:id/members/:memberId', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const memberId = req.params.memberId;
  const userId = req.user.userId;

  // Check if current user is owner
  db.get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member || member.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can remove members' });
      }

      // Don't allow removing the owner
      db.get('SELECT role FROM project_members WHERE id = ?', [memberId], (err, targetMember) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (targetMember && targetMember.role === 'owner') {
          return res.status(400).json({ error: 'Cannot remove project owner' });
        }

        db.run('DELETE FROM project_members WHERE id = ?', [memberId], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to remove member' });
          }

          res.json({ message: 'Member removed successfully' });
        });
      });
    }
  );
});

// Delete project
router.delete('/:id', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const userId = req.user.userId;

  // Check if user is owner
  db.get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member || member.role !== 'owner') {
        return res.status(403).json({ error: 'Only owners can delete projects' });
      }

      db.run('DELETE FROM projects WHERE id = ?', [projectId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete project' });
        }

        res.json({ message: 'Project deleted successfully' });
      });
    }
  );
});

module.exports = router;

