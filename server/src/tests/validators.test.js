import { describe, it, expect } from 'vitest';
import {
  customerRegisterSchema,
  companyRegisterSchema,
  registerSchema,
  loginSchema
} from '../utils/validators.js';

describe('Auth Validator Schemas', () => {
  describe('customerRegisterSchema', () => {
    it('validates a valid customer registration payload', () => {
      const payload = {
        name: 'Rahul Sharma',
        email: 'rahul@example.com',
        password: 'Password123',
        role: 'CUSTOMER'
      };
      const result = customerRegisterSchema.parse(payload);
      expect(result.name).toBe('Rahul Sharma');
      expect(result.email).toBe('rahul@example.com');
      expect(result.role).toBe('CUSTOMER');
    });

    it('rejects short passwords', () => {
      const payload = {
        name: 'Rahul',
        email: 'rahul@example.com',
        password: '123',
        role: 'CUSTOMER'
      };
      expect(() => customerRegisterSchema.parse(payload)).toThrow();
    });

    it('rejects invalid emails', () => {
      const payload = {
        name: 'Rahul',
        email: 'not-an-email',
        password: 'Password123',
        role: 'CUSTOMER'
      };
      expect(() => customerRegisterSchema.parse(payload)).toThrow();
    });
  });

  describe('companyRegisterSchema', () => {
    it('validates a valid company payload and transforms symbol to uppercase', () => {
      const payload = {
        name: 'Aditi Rao',
        email: 'aditi@solaris.in',
        password: 'Password123',
        role: 'COMPANY',
        companyName: 'Solaris Energy Ltd',
        sector: 'Renewable Energy',
        symbol: 'solar',
        mu: 0.15,
        sigma: 0.28
      };
      const result = companyRegisterSchema.parse(payload);
      expect(result.symbol).toBe('SOLAR');
      expect(result.companyName).toBe('Solaris Energy Ltd');
      expect(result.mu).toBe(0.15);
      expect(result.sigma).toBe(0.28);
    });

    it('rejects mu outside [0.05, 0.25]', () => {
      const lowMu = {
        name: 'Aditi',
        email: 'aditi@solaris.in',
        password: 'Password123',
        role: 'COMPANY',
        companyName: 'Solaris Ltd',
        sector: 'Energy',
        symbol: 'SOLAR',
        mu: 0.02, // < 0.05
        sigma: 0.25
      };
      expect(() => companyRegisterSchema.parse(lowMu)).toThrow(/mu must be >= 0.05/);

      const highMu = { ...lowMu, mu: 0.35 }; // > 0.25
      expect(() => companyRegisterSchema.parse(highMu)).toThrow(/mu must be <= 0.25/);
    });

    it('rejects sigma outside [0.15, 0.50]', () => {
      const lowSigma = {
        name: 'Aditi',
        email: 'aditi@solaris.in',
        password: 'Password123',
        role: 'COMPANY',
        companyName: 'Solaris Ltd',
        sector: 'Energy',
        symbol: 'SOLAR',
        mu: 0.12,
        sigma: 0.10 // < 0.15
      };
      expect(() => companyRegisterSchema.parse(lowSigma)).toThrow(/sigma must be >= 0.15/);

      const highSigma = { ...lowSigma, sigma: 0.65 }; // > 0.50
      expect(() => companyRegisterSchema.parse(highSigma)).toThrow(/sigma must be <= 0.50/);
    });

    it('rejects company registration missing companyName or symbol', () => {
      const missingFields = {
        name: 'Aditi',
        email: 'aditi@solaris.in',
        password: 'Password123',
        role: 'COMPANY'
      };
      expect(() => companyRegisterSchema.parse(missingFields)).toThrow();
    });
  });

  describe('registerSchema', () => {
    it('routes COMPANY payloads to the company schema', () => {
      const result = registerSchema.parse({
        name: 'Aditi Rao',
        email: 'aditi@solaris.in',
        password: 'Password123',
        role: 'COMPANY',
        companyName: 'Solaris Energy Ltd',
        sector: 'Renewable Energy',
        symbol: 'solar'
      });
      expect(result.role).toBe('COMPANY');
      expect(result.symbol).toBe('SOLAR');
    });

    it('rejects unknown roles', () => {
      expect(() => registerSchema.parse({
        name: 'Rahul',
        email: 'rahul@example.com',
        password: 'Password123',
        role: 'ADMIN'
      })).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('validates correct login credentials', () => {
      const payload = {
        email: 'trader@tradesim.in',
        password: 'Password123'
      };
      const result = loginSchema.parse(payload);
      expect(result.email).toBe('trader@tradesim.in');
    });

    it('rejects empty password or invalid email', () => {
      expect(() => loginSchema.parse({ email: 'bad-email', password: '123' })).toThrow();
      expect(() => loginSchema.parse({ email: 'test@example.com', password: '' })).toThrow();
    });
  });
});
