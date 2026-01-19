// All Resend email events
export type EmailStatus = 
	| 'bounced'          // Recipient's mail server rejected the email
	| 'canceled'         // Scheduled email was canceled
	| 'clicked'          // Recipient clicked a link
	| 'complained'       // Marked as spam
	| 'delivered'        // Successfully delivered
	| 'delivery_delayed' // Temporary delivery issue
	| 'failed'           // Failed to send
	| 'opened'           // Recipient opened email
	| 'queued'           // Queued for delivery (broadcasts/batches)
	| 'scheduled'        // Scheduled for later
	| 'sent'             // Sent successfully
	| 'suppressed'       // Recipient on suppression list

// Application-level status (can include custom statuses)
export type ApplicationStatus = 
	| EmailStatus
	| 'responded'        // We received a response
	| 'interview'        // Interview scheduled
	| 'offer'            // Received an offer
	| 'rejected'         // Rejected
	| 'rejected_later'   // Refus mais plus tard pk pas
	| 'rejected_after_interview' // Refus après entretien

export interface JobApplication {
	id: string
	company: string
	position?: string
	status: ApplicationStatus
	sentAt: string
	lastActivityAt: string
	lastResponseAt?: string
	firstContactAt?: string
	lastFollowUpAt?: string
	response?: string
	followUpCount: number
}
