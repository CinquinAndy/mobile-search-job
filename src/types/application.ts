export type ApplicationStatus = 
	| 'sent' 
	| 'delivered' 
	| 'opened' 
	| 'clicked' 
	| 'responded' 
	| 'bounced' 
	| 'rejected' 
	| 'interview' 
	| 'offer'

export interface JobApplication {
	id: string
	company: string
	position?: string
	status: ApplicationStatus
	sentAt: string
	lastActivityAt: string
	response?: string
	followUpCount: number
}
