import type { AuthRecord } from 'pocketbase'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
	getCurrentUser,
	type LoginCredentials,
	login as pbLogin,
	logout as pbLogout,
	register as pbRegister,
	type RegisterData,
	refreshAuth,
} from '@/services/pocketbase.client'

interface AuthState {
	user: AuthRecord | null
	isLoading: boolean
	isInitialized: boolean
	error: string | null
}

interface AuthActions {
	login: (credentials: LoginCredentials) => Promise<void>
	register: (data: RegisterData) => Promise<void>
	logout: () => void
	refresh: () => Promise<void>
	initialize: () => Promise<void>
	clearError: () => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
	persist(
		(set, get) => ({
			user: null,
			isLoading: false,
			isInitialized: false,
			error: null,

			login: async (credentials: LoginCredentials) => {
				set({ isLoading: true, error: null })
				try {
					const record = await pbLogin(credentials)
					set({ user: record, isLoading: false })
				} catch (err) {
					const message = err instanceof Error ? err.message : 'Login failed'
					set({ error: message, isLoading: false })
					throw err
				}
			},

			register: async (data: RegisterData) => {
				set({ isLoading: true, error: null })
				try {
					const record = await pbRegister(data)
					set({ user: record, isLoading: false })
				} catch (err) {
					const message = err instanceof Error ? err.message : 'Registration failed'
					set({ error: message, isLoading: false })
					throw err
				}
			},

			logout: () => {
				pbLogout()
				set({ user: null, error: null })
			},

			refresh: async () => {
				try {
					const refreshedUser = await refreshAuth()
					set({ user: refreshedUser })
				} catch {
					set({ user: null })
				}
			},

			initialize: async () => {
				if (get().isInitialized) return

				try {
					const currentUser = getCurrentUser()
					if (currentUser) {
						const refreshedUser = await refreshAuth()
						set({ user: refreshedUser, isInitialized: true })
					} else {
						set({ isInitialized: true })
					}
				} catch {
					set({ user: null, isInitialized: true })
				}
			},

			clearError: () => set({ error: null }),
		}),
		{
			name: 'auth-storage',
			partialize: state => ({ user: state.user }),
		}
	)
)

export const selectUser = (state: AuthStore) => state.user
export const selectIsAuthenticated = (state: AuthStore) => state.user !== null
export const selectIsLoading = (state: AuthStore) => state.isLoading
export const selectError = (state: AuthStore) => state.error
