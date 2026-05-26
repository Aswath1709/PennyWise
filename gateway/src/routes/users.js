/**
 * User Routes
 * Handles user profile management
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../services/database');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const result = await db.query(
    'SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1',
    [req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: result.rows[0] });
}));

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put('/profile', [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email } = req.body;
  const updates = [];
  const values = [];
  let paramCount = 1;

  if (name) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }

  if (email) {
    // Check if email is already taken
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    updates.push(`email = $${paramCount++}`);
    values.push(email);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.user.id);

  const result = await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, email, name, updated_at`,
    values
  );

  res.json({ 
    message: 'Profile updated',
    user: result.rows[0] 
  });
}));

/**
 * @swagger
 * /api/users/password:
 *   put:
 *     summary: Change password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put('/password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  // Get current password hash
  const result = await db.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);

  // Update password
  await db.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newHash, req.user.id]
  );

  res.json({ message: 'Password updated successfully' });
}));

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', asyncHandler(async (req, res) => {
  // Get transaction count
  const transactionCount = await db.query(
    'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1',
    [req.user.id]
  );

  // Get budget count
  const budgetCount = await db.query(
    'SELECT COUNT(*) as count FROM budgets WHERE user_id = $1',
    [req.user.id]
  );

  // Get statement uploads count
  const uploadCount = await db.query(
    'SELECT COUNT(*) as count FROM statement_uploads WHERE user_id = $1',
    [req.user.id]
  );

  res.json({
    stats: {
      totalTransactions: parseInt(transactionCount.rows[0].count),
      totalBudgets: parseInt(budgetCount.rows[0].count),
      totalUploads: parseInt(uploadCount.rows[0].count)
    }
  });
}));

module.exports = router;
