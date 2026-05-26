/**
 * Transaction Routes
 * Handles transaction CRUD operations
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const db = require('../services/database');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/transactions:
 * get:
 * summary: Get all transactions for user
 * tags: [Transactions]
 */
router.get('/', asyncHandler(async (req, res) => {
  const { startDate, endDate, category, accountId, accountType, limit, offset = 0 } = req.query;
  
  let queryText = `
    SELECT t.*, c.name as category_name, c.icon as category_icon,
           b.bank_name, b.account_type, b.account_last_four
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN bank_accounts b ON t.bank_account_id = b.id
    WHERE t.user_id = $1
  `;
  const params = [req.user.id];
  let paramCount = 2;

  if (startDate) {
    queryText += ` AND t.date >= $${paramCount++}`;
    params.push(startDate);
  }

  if (endDate) {
    queryText += ` AND t.date <= $${paramCount++}`;
    params.push(endDate);
  }

  if (category) {
    queryText += ` AND t.category_id = $${paramCount++}`;
    params.push(parseInt(category));
  }

  if (accountId) {
    queryText += ` AND t.bank_account_id = $${paramCount++}`;
    params.push(parseInt(accountId));
  }

  if (accountType) {
    queryText += ` AND b.account_type = $${paramCount++}`;
    params.push(accountType);
  }

  queryText += ` ORDER BY t.date DESC, t.id DESC`;
  
  if (limit && limit !== 'all') {
    queryText += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
  }

  const result = await db.query(queryText, params);

  let countQuery = `
    SELECT COUNT(*) 
    FROM transactions t 
    LEFT JOIN bank_accounts b ON t.bank_account_id = b.id 
    WHERE t.user_id = $1
  `;
  const countParams = [req.user.id];
  let countParamCount = 2;

  if (startDate) { countQuery += ` AND t.date >= $${countParamCount++}`; countParams.push(startDate); }
  if (endDate) { countQuery += ` AND t.date <= $${countParamCount++}`; countParams.push(endDate); }
  if (category) { countQuery += ` AND t.category_id = $${countParamCount++}`; countParams.push(parseInt(category)); }
  if (accountId) { countQuery += ` AND t.bank_account_id = $${countParamCount++}`; countParams.push(parseInt(accountId)); }
  if (accountType) { countQuery += ` AND b.account_type = $${countParamCount++}`; countParams.push(accountType); }

  const countResult = await db.query(countQuery, countParams);

  res.json({
    transactions: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit: limit === 'all' ? 'all' : (limit ? parseInt(limit) : 'all'),
    offset: parseInt(offset)
  });
}));

/**
 * @swagger
 * /api/transactions/bulk:
 * post:
 * summary: Create multiple transactions
 */
router.post('/bulk', asyncHandler(async (req, res) => {
  const { transactions, bank_metadata } = req.body;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'Transactions array required' });
  }

  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    let bank_account_id = null;
    if (bank_metadata && bank_metadata.bank_name) {
      const accCheck = await client.query(
        `SELECT id FROM bank_accounts WHERE user_id = $1 AND bank_name = $2 AND account_last_four = $3`,
        [req.user.id, bank_metadata.bank_name, bank_metadata.account_last4 || '']
      );
      if (accCheck.rows.length > 0) {
        bank_account_id = accCheck.rows[0].id;
      } else {
        const accInsert = await client.query(
          `INSERT INTO bank_accounts (user_id, bank_name, account_type, account_last_four)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [req.user.id, bank_metadata.bank_name, bank_metadata.statement_type || 'debit', bank_metadata.account_last4 || '']
        );
        bank_account_id = accInsert.rows[0].id;
      }
    }

    const insertedIds = [];
    
    for (const t of transactions) {
      const result = await client.query(
        // ai_categorized removed from columns and values below
        `INSERT INTO transactions (user_id, bank_account_id, date, description, amount, type, category_id, raw_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          req.user.id,
          bank_account_id,
          t.date,
          t.description,
          t.amount,
          t.type,
          t.category_id || null,
          t.raw_description || t.description
        ]
      );
      insertedIds.push(result.rows[0].id);
    }

    await client.query('COMMIT');
    res.status(201).json({ count: insertedIds.length, ids: insertedIds });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * @swagger
 * /api/transactions/{id}:
 * put:
 * summary: Update a transaction
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date, description, amount, type, category_id } = req.body;

  const updates = [];
  const values = [];
  let paramCount = 1;

  if (date) {
    updates.push(`date = $${paramCount++}`);
    values.push(date);
  }
  if (description) {
    updates.push(`description = $${paramCount++}`);
    values.push(description);
  }
  if (amount !== undefined) {
    updates.push(`amount = $${paramCount++}`);
    values.push(amount);
  }
  if (type) {
    updates.push(`type = $${paramCount++}`);
    values.push(type);
  }
  if (category_id !== undefined) {
    updates.push(`category_id = $${paramCount++}`);
    values.push(category_id);
    // ai_categorized = false line removed from here
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id, req.user.id);

  const result = await db.query(
    `UPDATE transactions SET ${updates.join(', ')} 
     WHERE id = $${paramCount++} AND user_id = $${paramCount}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

  res.json({ transaction: result.rows[0] });
}));

// Rest of existing routes (GET /:id, DELETE, SEARCH) remain same...
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json(result.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ message: 'Deleted' });
}));

module.exports = router;