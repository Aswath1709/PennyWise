import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useChatStore = create(
  persist(
    (set) => ({
      messages: [],
      isLoading: false,
      
      // Call this when the user sends or receives a message
      addMessage: (message) => set((state) => ({ 
        messages: [...state.messages, message] 
      })),

      setIsLoading: (loading) => set({ isLoading: loading }),

      // Call this if you want a "Clear Chat" button
      clearChat: () => set({ messages: [], isLoading: false }),
    }),
    {
      name: 'pennywise-chat-storage', // unique name for localStorage
    }
  )
)