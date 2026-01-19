import PocketBase, { type AuthRecord } from 'pocketbase'

const POCKETBASE_URL = process.env.NEXT_PUBLIC_PB_URL ?? 'https://jobs.andy-cinquin.fr'

function createClientPB(): PocketBase {
	const pb = new PocketBase(POCKETBASE_URL)
	pb.autoCancellation(false)
	return pb
}

let clientPB: PocketBase | null = null

export function getClientPB(): PocketBase {
	if (typeof window === 'undefined') {
		return createClientPB()
	}

	if (!clientPB) {
		clientPB = createClientPB()

		const storedAuth = localStorage.getItem('pb_auth')
		if (storedAuth) {
			try {
				const { token, record } = JSON.parse(storedAuth)
				clientPB.authStore.save(token, record)
			} catch {
				localStorage.removeItem('pb_auth')
			}
		}

		clientPB.authStore.onChange((token, record) => {
			if (token && record) {
				localStorage.setItem('pb_auth', JSON.stringify({ token, record }))
			} else {
				localStorage.removeItem('pb_auth')
			}
		})
	}

	return clientPB
}

export interface LoginCredentials {
	email: string
	password: string
}

export interface RegisterData {
	email: string
	password: string
	passwordConfirm: string
	name?: string
}

export async function login(credentials: LoginCredentials): Promise<AuthRecord> {
	const pb = getClientPB()
	const authData = await pb.collection('users').authWithPassword(credentials.email, credentials.password)
	return authData.record
}

export async function register(data: RegisterData): Promise<AuthRecord> {
	const pb = getClientPB()
	const record = await pb.collection('users').create(data)
	await pb.collection('users').authWithPassword(data.email, data.password)
	return record as AuthRecord
}

export function logout(): void {
	const pb = getClientPB()
	pb.authStore.clear()
}

export async function refreshAuth(): Promise<AuthRecord | null> {
	const pb = getClientPB()
	if (!pb.authStore.isValid) {
		return null
	}

	try {
		const authData = await pb.collection('users').authRefresh()
		return authData.record
	} catch {
		pb.authStore.clear()
		return null
	}
}

export function getCurrentUser(): AuthRecord | null {
	const pb = getClientPB()
	if (!pb.authStore.isValid) {
		return null
	}
	return pb.authStore.record as AuthRecord
}

export function isAuthenticated(): boolean {
	const pb = getClientPB()
	return pb.authStore.isValid
}

export function getAuthToken(): string | null {
	const pb = getClientPB()
	return pb.authStore.token || null
}
