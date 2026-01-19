import { Resend } from 'resend'

const RESEND_KEY = process.env.RESEND_KEY

if (!RESEND_KEY) {
	console.warn('[ResendService] RESEND_KEY is missing. Resend integration will not work.')
}

export const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null

export interface ResendEmailUpdate {
	id: string
	to: string[]
	subject: string
	created_at: string
	status: string
}

export const resendService = {
	/**
	 * List sent emails from Resend
	 * Note: Resend pagination might be needed for very large lists
	 */
	async listSentEmails(): Promise<ResendEmailUpdate[]> {
		if (!resend) throw new Error('Resend client not initialized')

		const response = await resend.emails.list()

		if (response.error) {
			throw new Error(`Resend Error: ${response.error.message}`)
		}

		// Map to a consistent internal format if needed
		return (response.data?.data || []).map((email: any) => ({
			id: email.id,
			to: email.to,
			subject: email.subject,
			created_at: email.created_at,
			status: email.last_event || 'sent', 
		}))
	},

	async getEmailDetails(id: string) {
		if (!resend) throw new Error('Resend client not initialized')

		const response = await resend.emails.get(id)
		
		if (response.error) {
			throw new Error(`Resend Error: ${response.error.message}`)
		}

		return response.data
	},
}
