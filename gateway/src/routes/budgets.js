/**
 * Budget Routes
 * Handles budget management and alerts
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../services/database');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/budgets:
 *   get:
 *     summary: Get all budgets with spending progress
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', asyncHandler(async (req, res) => {
  // Get budgets with spending progress
  const result = await db.query(
    `SELECT 
      b.*,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      COALESCE(spent.total, 0) as spent_amount
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN (
      SELECT category_id, SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 
        AND type = 'debit'
        AND date >= date_trunc('month', CURRENT_DATE)
      GROUP BY category_id
    ) spent ON b.category_id = spent.category_id
    WHERE b.user_id = $1
    ORDER BY b.created_at DESC`,
    [req.user.id]
  );

  // Calculate progress for each budget
  const budgets = result.rows.map(b => {
    const spent = parseFloat(b.spent_amount);
    const budget = parseFloat(b.amount);
    const remaining = budget - spent;
    const percentageUsed = (spent / budget) * 100;

    return {
      ...b,
      spent_amount: spent,
      remaining: remaining,
      percentage_used: Math.round(percentageUsed * 100) / 100,
      is_over_budget: spent > budget,
      alert_triggered: percentageUsed >= b.alert_threshold
    };
  });

  res.json({ budgets });
}));

/**
 * @swagger
 * /api/budgets:
 *   post:
 *     summary: Create a new budget
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', [
  body('category_id').isInt(),
  body('amount').isFloat({ min: 0.01 }),
  body('period').isIn(['weekly', 'monthly', 'yearly']),
  body('alert_threshold').optional().isFloat({ min: 0, max: 100 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { category_id, amount, period, alert_threshold = 80 } = req.body;

  // Check if budget already exists for this category
  const existing = await db.query(
    'SELECT id FROM budgets WHERE user_id = $1 AND category_id = $2',
    [req.user.id, category_id]
  );

  if (existing.rows.length > 0) {
    return res.status(409).json({ 
      error: 'Budget already exists for this category',
      existing_budget_id: existing.rows[0].id
    });
  }

  // Verify category exists
  const category = await db.query(
    'SELECT id, name FROM categories WHERE id = $1 AND (is_default = true OR user_id = $2)',
    [category_id, req.user.id]
  );

  if (category.rows.length === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }

  // Create budget
  const result = await db.query(
    `INSERT INTO budgets (user_id, category_id, amount, period, alert_threshold, start_date)
     VALUES ($1, $2, $3, $4, $5, date_trunc('month', CURRENT_DATE))
     RETURNING *`,
    [req.user.id, category_id, amount, period, alert_threshold]
  );

  res.status(201).json({
    message: 'Budget created',
    budget: {
      ...result.rows[0],
      category_name: category.rows[0].name
    }
  });
}));

/**
 * @swagger
 * /api/budgets/{id}:
 *   put:
 *     summary: Update a budget
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, period, alert_threshold } = req.body;

  const updates = [];
  const values = [];
  let paramCount = 1;

  if (amount !== undefined) {
    updates.push(`amount = $${paramCount++}`);
    values.push(amount);
  }
  if (period) {
    updates.push(`period = $${paramCount++}`);
    values.push(period);
  }
  if (alert_threshold !== undefined) {
    updates.push(`alert_threshold = $${paramCount++}`);
    values.push(alert_threshold);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push(`updated_at = NOW()`);
  values.push(id, req.user.id);

  const result = await db.query(
    `UPDATE budgets SET ${updates.join(', ')} 
     WHERE id = $${paramCount++} AND user_id = $${paramCount}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  res.json({
    message: 'Budget updated',
    budget: result.rows[0]
  });
}));

/**
 * @swagger
 * /api/budgets/{id}:
 *   delete:
 *     summary: Delete a budget
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  res.json({ message: 'Budget deleted' });
}));

/**
 * @swagger
 * /api/budgets/alerts:
 *   get:
 *     summary: Get budget alerts
 *     tags: [Budgets]
 *     security:
 *       - bearerAuth: []
 */
router.get('/alerts/active', asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT 
      b.*,
      c.name as category_name,
      COALESCE(spent.total, 0) as spent_amount
    FROM budgets b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN (
      SELECT category_id, SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 
        AND type = 'debit'
        AND date >= date_trunc('month', CURRENT_DATE)
      GROUP BY category_id
    ) spent ON b.category_id = spent.category_id
    WHERE b.user_id = $1`,
    [req.user.id]
  );

  const alerts = result.rows
    .map(b => {
      const spent = parseFloat(b.spent_amount);
      const budget = parseFloat(b.amount);
      const percentageUsed = (spent / budget) * 100;

      if (spent > budget) {
        return {
          budget_id: b.id,
          category_name: b.category_name,
          severity: 'over',
          message: `You've exceeded your ${b.category_name} budget by $${(spent - budget).toFixed(2)}`,
          percentage_used: percentageUsed
        };
      } else if (percentageUsed >= b.alert_threshold) {
        return {
          budget_id: b.id,
          category_name: b.category_name,
          severity: percentageUsed >= 95 ? 'critical' : 'warning',
          message: `You've used ${percentageUsed.toFixed(0)}% of your ${b.category_name} budget`,
          percentage_used: percentageUsed
        };
      }
      return null;
    })
    .filter(a => a !== null);

  res.json({ alerts });
}));

module.exports = router;
