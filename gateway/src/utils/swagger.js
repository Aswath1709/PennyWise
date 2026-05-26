/**
 * Swagger Configuration
 * API Documentation setup
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PennyWise API',
      version: '2.0.0',
      description: 'Personal finance management API with AI-powered features',
      contact: {
        name: 'PennyWise Team'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            date: { type: 'string', format: 'date' },
            description: { type: 'string' },
            amount: { type: 'number' },
            type: { type: 'string', enum: ['debit', 'credit'] },
            category_id: { type: 'integer' },
            category_name: { type: 'string' }
          }
        },
        Budget: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            category_id: { type: 'integer' },
            amount: { type: 'number' },
            period: { type: 'string', enum: ['weekly', 'monthly', 'yearly'] },
            alert_threshold: { type: 'number' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Transactions', description: 'Transaction CRUD operations' },
      { name: 'Budgets', description: 'Budget management' },
      { name: 'Data Service', description: 'AI and analytics endpoints' }
    ]
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
