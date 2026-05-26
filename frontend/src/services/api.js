import axios from 'axios'
import toast from 'react-hot-toast'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 60000, // 60 seconds for AI operations
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Token is set in authStore
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Something went wrong'
    if (error.response?.data?.error) {
      message = error.response.data.error
    } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      message = error.response.data.errors.map(e => e.msg).join(', ')
    } else if (error.message) {
      message = error.message
    }
    
    // Add the extracted message to the error object so callers can use it
    error.extractedMessage = message;
    // Handle specific error codes
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('pennywise-auth')
      window.location.href = '/login'
      toast.error('Session expired. Please login again.')
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please slow down.')
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.')
    }
    
    return Promise.reject(error)
  }
)

export default api

// Convenience methods for data service
export const dataService = {
  // PDF parsing
  parsePDF: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/data/pdf/parse-and-categorize', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // Analytics
  getAnalytics: (transactions) => 
    api.post('/data/analytics/summary', { transactions }),

  getSpendingByCategory: (transactions) => 
    api.post('/data/analytics/spending-by-category', { transactions }),

  getMonthlyTrend: (transactions) => 
    api.post('/data/analytics/monthly-trend', { transactions }),

  // Charts
  getCategoryPieChart: (transactions) => 
    api.post('/data/analytics/charts/category-pie', { transactions }),

  getMonthlyTrendChart: (transactions) => 
    api.post('/data/analytics/charts/monthly-trend', { transactions }),

  // AI Insights
  generateInsights: (transactions) => 
    api.post('/data/insights/generate', { transactions }),

  getSpendingAlerts: (transactions) => 
    api.post('/data/insights/spending-alerts', { transactions }),

  getSavingsOpportunities: (transactions) => 
    api.post('/data/insights/savings-opportunities', { transactions }),

  // Natural Language Query
  askQuestion: (query, transactions) => 
    api.post('/data/query', { query, transactions }),

  getQuickAnswer: (query, transactions) => 
    api.post('/data/query/quick-answers', { query, transactions }),

  getQuerySuggestions: () => 
    api.get('/data/query/suggestions'),

  // Categories
  getCategories: () => 
    api.get('/data/categorize/categories')
}
