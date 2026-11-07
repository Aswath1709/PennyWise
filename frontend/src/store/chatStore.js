import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './authStore'

// Chats are kept per user id, so different accounts on the same browser
// never see each other's conversations.
const currentUserId = () => useAuthStore.getState().user?.id

export const useChatStore = create(
  persist(
    (set) => ({
      chats: {}, // { [userId]: message[] }
      isLoading: false,

      // userId defaults to whoever is logged in; pass it explicitly when a reply
      // arrives after an await, so it lands in the chat of the user who asked.
      addMessage: (message, userId = currentUserId()) => {
        if (userId == null) return
        set((state) => ({
          chats: { ...state.chats, [userId]: [...(state.chats[userId] || []), message] }
        }))
      },

      setIsLoading: (loading) => set({ isLoading: loading }),

      // Clears only the current user's chat
      clearChat: (userId = currentUserId()) => {
        if (userId == null) return
        set((state) => {
          const chats = { ...state.chats }
          delete chats[userId]
          return { chats, isLoading: false }
        })
      },
    }),
    {
      name: 'pennywise-chat-storage', // localStorage key
      version: 1,
      // Version 0 stored one shared `messages` list that can't be attributed to a user: drop it.
      migrate: () => ({ chats: {} }),
      partialize: (state) => ({ chats: state.chats }),
    }
  )
)

const NO_MESSAGES = []

// Messages of the logged-in user (stable empty array so components don't re-render needlessly)
export const useMyMessages = () => {
  const userId = useAuthStore((s) => s.user?.id)
  return useChatStore((s) => (userId != null && s.chats[userId]) || NO_MESSAGES)
}
