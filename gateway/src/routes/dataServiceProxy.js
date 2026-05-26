/**
 * Data Service Proxy
 * Routes requests to the Python data processing microservice
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const { asyncHandler } = require('../middleware/errorHandler');

// Data service URL
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8000';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/**
 * Create axios instance for data service
 */
const dataServiceClient = axios.create({
  baseURL: DATA_SERVICE_URL,
  timeout: 60000, // 60 seconds for AI processing
});

// ============ PDF Parsing ============

/**
 * @swagger
 * /api/data/pdf/parse:
 *   post:
 *     summary: Parse a bank statement PDF
 *     tags: [Data Service]
 *     security:
 *       - bearerAuth: []
 */
router.post('/pdf/parse', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'PDF file required' });
  }

  // Forward to Python service
  const formData = new FormData();
  formData.append('file', req.file.buffer, {
    filename: req.file.originalname,
    contentType: 'application/pdf'
  });

  const response = await dataServiceClient.post('/api/pdf/parse', formData, {
    headers: formData.getHeaders()
  });

  res.json(response.data);
}));

/**
 * @swagger
 * /api/data/pdf/parse-and-categorize:
 *   post:
 *     summary: Parse PDF and auto-categorize transactions
 *     tags: [Data Service]
 *     security:
 *       - bearerAuth: []
 */
router.post('/pdf/parse-and-categorize', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'PDF file required' });
  }

  const formData = new FormData();
  formData.append('file', req.file.buffer, {
    filename: req.file.originalname,
    contentType: 'application/pdf'
  });

  const response = await dataServiceClient.post('/api/pdf/parse-and-categorize', formData, {
    headers: formData.getHeaders()
  });

  res.json(response.data);
}));

// ============ Categorization ============

/**
 * @swagger
 * /api/data/categorize:
 *   post:
 *     summary: Categorize transactions using AI
 *     tags: [Data Service]
 *     security:
 *       - bearerAuth: []
 */
router.post('/categorize', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/categorize/', req.body);
  res.json(response.data);
}));

router.get('/categorize/categories', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.get('/api/categorize/categories');
  res.json(response.data);
}));

// ============ Analytics ============

/**
 * @swagger
 * /api/data/analytics/summary:
 *   post:
 *     summary: Get analytics summary
 *     tags: [Data Service]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analytics/summary', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/analytics/summary', req.body);
  res.json(response.data);
}));

router.post('/analytics/spending-by-category', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/analytics/spending-by-category', req.body);
  res.json(response.data);
}));

router.post('/analytics/monthly-trend', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/analytics/monthly-trends', req.body);
  res.json(response.data);
}));

router.post('/analytics/top-merchants', asyncHandler(async (req, res) => {
  const limit = req.query.limit || 10;
  const response = await dataServiceClient.post(`/api/analytics/top-merchants?limit=${limit}`, req.body);
  res.json(response.data);
}));

router.post('/analytics/anomalies', asyncHandler(async (req, res) => {
  const threshold = req.query.threshold || 2.0;
  const response = await dataServiceClient.post(`/api/analytics/anomalies?threshold=${threshold}`, req.body);
  res.json(response.data);
}));

// ============ Charts ============

router.post('/analytics/charts/category-pie', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/analytics/charts/category-pie', req.body);
  res.json(response.data);
}));

router.post('/analytics/charts/monthly-trend', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/analytics/charts/monthly-trend', req.body);
  res.json(response.data);
}));

router.post('/analytics/charts/daily-spending', asyncHandler(async (req, res) => {
  const days = req.query.days || 30;
  const response = await dataServiceClient.post(`/api/analytics/charts/daily-spending?days=${days}`, req.body);
  res.json(response.data);
}));

// ============ AI Insights ============

/**
 * @swagger
 * /api/data/insights/generate:
 *   post:
 *     summary: Generate AI insights
 *     tags: [Data Service]
 *     security:
 *       - bearerAuth: []
 */
router.post('/insights/generate', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/insights/generate', req.body);
  res.json(response.data);
}));

router.post('/insights/spending-alerts', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/insights/spending-alerts', req.body);
  res.json(response.data);
}));

router.post('/insights/savings-opportunities', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/insights/savings-opportunities', req.body);
  res.json(response.data);
}));

// ============ Natural Language Query ============

/**
 * @swagger
 * /api/data/query:
 *   post:
 *     summary: Ask a question about your finances
 *     tags: [Data Service]
 *     security:
 *       - bearerAuth: []
 */
router.post('/query', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/query/', req.body);
  res.json(response.data);
}));

router.post('/query/quick-answers', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.post('/api/query/quick-answers', req.body);
  res.json(response.data);
}));

router.get('/query/suggestions', asyncHandler(async (req, res) => {
  const response = await dataServiceClient.get('/api/query/suggestions');
  res.json(response.data);
}));

// ============ Health Check ============

router.get('/health', asyncHandler(async (req, res) => {
  try {
    const response = await dataServiceClient.get('/health');
    res.json({
      gateway: 'healthy',
      dataService: response.data.status
    });
  } catch (error) {
    res.status(503).json({
      gateway: 'healthy',
      dataService: 'unhealthy',
      error: error.message
    });
  }
}));

module.exports = router;