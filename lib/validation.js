import { z } from 'zod'

// Reusable validators
const phoneRegex = /^(\+90|0)?[1-9][0-9]{9}$/
const taxNoRegex = /^[0-9]{10,11}$/

export const emailSchema = z.string().email('Geçerli bir e-posta adresi girin')
export const phoneSchema = z.string().regex(phoneRegex, 'Geçerli bir telefon numarası girin (05XX XXX XX XX)')
export const taxNoSchema = z.string().regex(taxNoRegex, 'Vergi numarası 10 veya 11 haneli olmalıdır')
export const requiredString = z.string().min(1, 'Bu alan zorunludur')

// Customer form validation
export const customerSchema = z.object({
  company_name: requiredString.min(2, 'Firma adı en az 2 karakter olmalıdır'),
  contact_name: requiredString.min(2, 'İletişim kişisi adı zorunludur'),
  email: emailSchema,
  phone: phoneSchema,
  tax_number: taxNoSchema.optional().or(z.literal('')),
  tax_office: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
})

// Staff user form validation
export const staffSchema = z.object({
  name: requiredString.min(2, 'Ad en az 2 karakter olmalıdır'),
  email: emailSchema,
  role: z.enum(['ADMIN', 'SALES', 'OPERATIONS', 'DRIVER'], { message: 'Geçerli bir rol seçin' }),
  phone: phoneSchema.optional().or(z.literal('')),
})

// Login form validation
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(4, 'Şifre en az 4 karakter olmalıdır'),
})

// Proposal item validation
export const proposalItemSchema = z.object({
  machine_id: requiredString,
  rental_type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  rental_duration: z.number().min(1, 'Süre en az 1 olmalıdır'),
  unit_price: z.number().min(0, 'Fiyat 0 veya daha büyük olmalıdır'),
  transport_price: z.number().min(0).optional(),
  city: z.string().optional(),
  district: z.string().optional(),
})

// Message form validation
export const messageSchema = z.object({
  subject: requiredString.max(200, 'Konu en fazla 200 karakter olabilir'),
  body: requiredString.max(5000, 'Mesaj en fazla 5000 karakter olabilir'),
})

/**
 * Validate data against a schema, return { success, data, errors }
 * errors is a flat object: { fieldName: 'error message' }
 */
export function validate(schema, data) {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data, errors: {} }
  }
  const errors = {}
  for (const issue of result.error.issues) {
    const field = issue.path.join('.')
    if (!errors[field]) {
      errors[field] = issue.message
    }
  }
  return { success: false, data: null, errors }
}

/**
 * Validate a single field
 */
export function validateField(schema, field, value) {
  const partial = {}
  partial[field] = value
  const result = schema.safeParse(partial)
  if (result.success) return null
  const fieldError = result.error.issues.find(i => i.path[0] === field)
  return fieldError?.message || null
}
