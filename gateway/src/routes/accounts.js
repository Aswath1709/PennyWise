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
  const queryText = `
    SELECT * FROM bank_accounts
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;
  const result = await db.query(queryText, [req.user.id]);
  res.json({ accounts: result.rows });
}));

module.exports = router;
