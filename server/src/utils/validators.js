import { z } from 'zod';

export const customerRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.literal('CUSTOMER').default('CUSTOMER')
});

export const companyRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.literal('COMPANY'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  sector: z.string().min(2, 'Sector must be at least 2 characters'),
  symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  initialPrice: z.number().positive().default(1000),
  mu: z.number().min(0.05, 'mu must be >= 0.05').max(0.25, 'mu must be <= 0.25').optional(),
  sigma: z.number().min(0.15, 'sigma must be >= 0.15').max(0.50, 'sigma must be <= 0.50').optional(),
  totalShares: z.number().positive().default(50000000)
});

// Discriminated or branching register schema
export const registerSchema = z.discriminatedUnion('role', [
  customerRegisterSchema,
  companyRegisterSchema
]);

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

/**
 * Generates a random float in range [min, max] rounded to 4 decimals.
 */
export function randomInRange(min, max) {
  const val = min + Math.random() * (max - min);
  return Math.round(val * 10000) / 10000;
}
