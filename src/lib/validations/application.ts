import * as v from 'valibot'

export const createApplicationSchema = v.object({
	companyName: v.pipe(v.string(), v.minLength(2, 'Company name is required')),
	domain: v.pipe(v.string(), v.minLength(4, 'Domain is required'), v.includes('.', 'Invalid domain format')),
	position: v.pipe(v.string(), v.minLength(2, 'Position is required')),
	website: v.optional(v.pipe(v.string(), v.url('Invalid URL format'))),
	notes: v.optional(v.string()),
})

export type CreateApplicationInput = v.InferOutput<typeof createApplicationSchema>
