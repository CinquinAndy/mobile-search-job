'use client'

import { Loader2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'

interface AuthGuardProps {
	children: ReactNode
}

const PUBLIC_ROUTES = ['/sign-in', '/forgot-password']

export function AuthGuard({ children }: AuthGuardProps) {
	const router = useRouter()
	const pathname = usePathname()
	const { user, isInitialized, initialize } = useAuthStore()

	const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
	const isAuthenticated = user !== null

	useEffect(() => {
		initialize()
	}, [initialize])

	useEffect(() => {
		if (!isInitialized) return

		if (!isAuthenticated && !isPublicRoute) {
			router.replace('/sign-in')
		} else if (isAuthenticated && isPublicRoute) {
			router.replace('/')
		}
	}, [isAuthenticated, isPublicRoute, isInitialized, router])

	if (!isInitialized) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-4">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
					<p className="text-sm text-muted-foreground">Initializing...</p>
				</div>
			</div>
		)
	}

	if (!isAuthenticated && !isPublicRoute) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		)
	}

	if (isAuthenticated && isPublicRoute) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		)
	}

	return <>{children}</>
}
