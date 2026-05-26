import { create } from 'zustand'
import api from '../services/api'

export const useTransactionStore = create((set, get) => ({
  transactions: [],
  accounts: [],
  analytics: null,
  isLoading: false,
  error: null,

  // Fetch transactions
  fetchTransactions: async (params = {}) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.get('/transactions', { params })
      set({ 
        transactions: response.data.transactions, 
        isLoading: false 
      })
      return response.data
    } catch (error) {
      set({ 
        error: error.response?.data?.error || 'Failed to fetch transactions', 
        isLoading: false 
      })
      return null
    }
  },

  // Fetch bank accounts
  fetchAccounts: async () => {
    try {
      const response = await api.get('/accounts')
      set({ accounts: response.data.accounts })
      return response.data.accounts
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
      return []
    }
  },

  // Add transaction
  addTransaction: async (transaction) => {
    try {
      const response = await api.post('/transactions', transaction)
      set(state => ({
        transactions: [response.data.transaction, ...state.transactions]
      }))
      return { success: true, transaction: response.data.transaction }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to add transaction' 
      }
    }
  },

  // Bulk add transactions
  bulkAddTransactions: async (transactions, bank_metadata = null) => {
    try {
      const response = await api.post('/transactions/bulk', { transactions, bank_metadata })
      // Refresh transactions list
      await get().fetchTransactions()
      return { success: true, count: response.data.count }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to add transactions' 
      }
    }
  },

  // Update transaction
  updateTransaction: async (id, updates) => {
    try {
      const response = await api.put(`/transactions/${id}`, updates)
      set(state => ({
        transactions: state.transactions.map(t => 
          t.id === id ? response.data.transaction : t
        )
      }))
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to update transaction' 
      }
    }
  },

  // Delete transaction
  deleteTransaction: async (id) => {
    try {
      await api.delete(`/transactions/${id}`)
      set(state => ({
        transactions: state.transactions.filter(t => t.id !== id)
      }))
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to delete transaction' 
      }
    }
  },

  // Bulk delete transactions
  bulkDeleteTransactions: async (ids) => {
    try {
      // Try bulk endpoint first, fall back to sequential individual deletes
      try {
        await api.post('/transactions/bulk-delete', { ids })
      } catch {
        await Promise.all(ids.map(id => api.delete(`/transactions/${id}`)))
      }
      set(state => ({
        transactions: state.transactions.filter(t => !ids.includes(t.id))
      }))
      return { success: true, count: ids.length }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to delete transactions' 
      }
    }
  },

  // Fetch analytics
  fetchAnalytics: async () => {
    const { transactions } = get()
    if (transactions.length === 0) return null

    try {
      const txData = transactions.map(t => ({
        date: t.date,
        description: t.description,
        amount: parseFloat(t.amount),
        type: t.type,
        category_id: t.category_id,
        category_name: t.category_name
      }))

      // Call all three endpoints in parallel
      const [summaryRes, categoryRes, trendRes] = await Promise.all([
        api.post('/data/analytics/summary', { transactions: txData }),
        api.post('/data/analytics/spending-by-category', { transactions: txData }),
        api.post('/data/analytics/monthly-trend', { transactions: txData })
      ])

      const analytics = {
        ...summaryRes.data,
        spending_by_category: categoryRes.data.categories || [],
        monthly_trend: trendRes.data.trends || trendRes.data.monthly_trends || []
      }

      set({ analytics })
      return analytics
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      return null
    }
  },

  // Clear all
  clearTransactions: () => set({ transactions: [], analytics: null })
}))