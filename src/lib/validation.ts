import { z } from 'zod';

// Install zod if not already: npm install zod
// We use zod for all server-side input validation.

export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(255, 'Email too long')
    .email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  display_name: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(100, 'Display name too long'),
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .email(),
  password: z
    .string()
    .min(1)
    .max(128),
});

export const guestAccessSchema = z.object({
  access_code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{8}$/, 'Invalid access code format'),
  guest_name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name too long'),
});

export const displayNameSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(100, 'Display name too long'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type GuestAccessInput = z.infer<typeof guestAccessSchema>;
