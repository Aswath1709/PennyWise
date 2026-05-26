import { create } from 'zustand'
import api from '../services/api'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Login
  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.post('/auth/login', { email, password })
      const { user, token } = response.data
      
      set({ 
        user, 
        token, 
        isAuthenticated: true, 
        isLoading: false 
      })
      
      // Set token in API client
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      return { success: true }
    } catch (error) {
      const message = error.extractedMessage || 'Login failed'
      set({ error: message, isLoading: false })
      return { success: false, error: message }
    }
  },

  // Register
  register: async (name, email, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.post('/auth/register', { name, email, password })
      const { user, token } = response.data
      
      set({ 
        user, 
        token, 
        isAuthenticated: true, 
        isLoading: false 
      })
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      return { success: true }
    } catch (error) {
      const message = error.extractedMessage || 'Registration failed'
      set({ error: message, isLoading: false })
      return { success: false, error: message }
    }
  },

  // Logout
  logout: () => {
    set({ 
      user: null, 
      token: null, 
      isAuthenticated: false,
      error: null 
    })
    delete api.defaults.headers.common['Authorization']
  },

  // Initialize auth from stored token
  initializeAuth: () => {
    const { token } = get()
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  },

  // Clear error
  clearError: () => set({ error: null })
}))

// Initialize auth on app load
useAuthStore.getState().initializeAuth()
