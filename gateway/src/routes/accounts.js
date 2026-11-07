const express = require('express');
const router = express.Router();
const db = require('../services/database');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @swagger
 * /api/accounts:
 * get:
 * summary: Get all bank accounts for user
 * tags: [Accounts]
 */
router.get('/', asyncHandler(async (req, res) => {
  // Only accounts that still have transactions, so accounts left empty after
  // deleting transactions (or re-uploading statements) don't clutter the filters.
  const queryText = `
    SELECT b.*, COUNT(t.id)::int AS transaction_count
    FROM bank_accounts b
    JOIN transactions t ON t.bank_account_id = b.id AND t.user_id = b.user_id
    WHERE b.user_id = $1
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `;
  const result = await db.query(queryText, [req.user.id]);
  res.json({ accounts: result.rows });
}));

module.exports = router;
