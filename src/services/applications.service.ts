import type { JobApplication } from '@/types/application'
import { getClientPB } from './pocketbase.client'

interface CompanyRecord {
	id: string
	name: string
	domain: string
	website?: string
}

interface ApplicationRecord {
	id: string
	position: string
	status: JobApplication['status']
	created: string
	updated: string
	last_activity_at?: string
	last_response_at?: string
	first_contact_at?: string
	last_follow_up_at?: string
	follow_up_count?: number
	expand?: {
		company?: CompanyRecord
	}
}

export const applicationsService = {
	async getApplications(): Promise<JobApplication[]> {
		const pb = getClientPB()
		// No fallback here, real data only
		const records = await pb.collection('applications').getFullList<ApplicationRecord>({
			sort: '-created',
			expand: 'company',
		})

		return records.map(record => ({
			id: record.id,
			company: record.expand?.company?.name || 'Unknown',
			position: record.position,
			status: record.status,
			sentAt: record.created,
			lastActivityAt: record.last_activity_at || record.updated,
			lastResponseAt: record.last_response_at,
			firstContactAt: record.first_contact_at || record.created,
			lastFollowUpAt: record.last_follow_up_at,
			followUpCount: record.follow_up_count || 0,
		}))
	},

	async getApplication(id: string): Promise<JobApplication | null> {
		const pb = getClientPB()
		try {
			const record = await pb.collection('applications').getOne<ApplicationRecord>(id, {
				expand: 'company',
			})
			return {
				id: record.id,
				company: record.expand?.company?.name || 'Unknown',
				position: record.position,
				status: record.status,
				sentAt: record.created,
				lastActivityAt: record.last_activity_at || record.updated,
				lastResponseAt: record.last_response_at,
				firstContactAt: record.first_contact_at || record.created,
				lastFollowUpAt: record.last_follow_up_at,
				followUpCount: record.follow_up_count || 0,
			}
		} catch {
			return null
		}
	},

	async createApplication(data: {
		companyName: string
		domain: string
		position: string
		website?: string
		notes?: string
	}): Promise<string> {
		const pb = getClientPB()
		const userId = pb.authStore.model?.id

		if (!userId) throw new Error('User not authenticated')

		// 1. Find or create company
		let companyId: string
		try {
			const existing = await pb.collection('companies').getFirstListItem(`domain="${data.domain}"`)
			companyId = existing.id
		} catch {
			const newCompany = await pb.collection('companies').create({
				name: data.companyName,
				domain: data.domain,
				website: data.website,
				user: userId,
			})
			companyId = newCompany.id
		}

		// 2. Create application
		const application = await pb.collection('applications').create({
			company: companyId,
			position: data.position,
			status: 'sent',
			notes: data.notes,
			user: userId,
			first_contact_at: new Date().toISOString(),
		})

		return application.id
	},

	async getApplicationTimeline(id: string) {
		const pb = getClientPB()
		return await pb.collection('email_logs').getFullList({
			filter: `application="${id}"`,
			sort: '-sent_at',
		})
	},

	async updateStatus(id: string, status: JobApplication['status']): Promise<void> {
		const pb = getClientPB()
		await pb.collection('applications').update(id, {
			status,
			last_activity_at: new Date().toISOString(),
		})
	},

	async incrementFollowUp(id: string): Promise<void> {
		const pb = getClientPB()
		const current = await pb.collection('applications').getOne<ApplicationRecord>(id)
		await pb.collection('applications').update(id, {
			follow_up_count: (current.follow_up_count || 0) + 1,
			last_follow_up_at: new Date().toISOString(),
			last_activity_at: new Date().toISOString(),
		})
	},
}
