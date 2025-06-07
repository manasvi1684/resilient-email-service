// src/__tests__/EmailService.test.ts

import { EmailService, TrackedEmail } from '../services/EmailService';
import { IEmailProvider, EmailPayload } from '../interfaces/IEmailProvider';

// A controllable mock provider for testing
class ControllableMockProvider implements IEmailProvider {
  private shouldFail: boolean;
  private name: string;
  public sendCalledCount = 0;

  constructor(name: string, shouldFail: boolean) {
    this.name = name;
    this.shouldFail = shouldFail;
  }

  getName(): string {
    return this.name;
  }

  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; providerName: string; }> {
    this.sendCalledCount++;
    if (this.shouldFail) {
      throw new Error(`Controlled failure from ${this.name}`);
    }
    return { success: true, providerName: this.name };
  }
}

const emailPayload: EmailPayload = {
  to: 'test@example.com',
  from: 'service@example.com',
  subject: 'Test Email',
  body: 'This is a test.',
};

describe('EmailService', () => {
  let provider1: ControllableMockProvider;
  let provider2: ControllableMockProvider;
  let emailService: EmailService;

  beforeEach(() => {
    // Reset mocks before each test
    provider1 = new ControllableMockProvider('Provider1', false);
    provider2 = new ControllableMockProvider('Provider2', false);
    emailService = new EmailService([provider1, provider2]);
  });

  // Test 1: Happy Path
  it('should send an email successfully with the primary provider', async () => {
    const result = await emailService.sendEmail(emailPayload, 'id-1');
    expect(result.status).toBe('sent');
    expect(result.provider).toBe('Provider1');
    expect(provider1.sendCalledCount).toBe(1);
    expect(provider2.sendCalledCount).toBe(0);
  });

  // Test 2: Fallback Mechanism
  it('should fall back to the secondary provider if the primary fails', async () => {
    provider1.setShouldFail(true); // Make provider1 fail every time
    const result = await emailService.sendEmail(emailPayload, 'id-2');
    
    expect(result.status).toBe('sent');
    expect(result.provider).toBe('Provider2');
    expect(provider1.sendCalledCount).toBe(3); // 1 initial + 2 retries
    expect(provider2.sendCalledCount).toBe(1);
  });

  // Test 3: All Providers Fail
  it('should return a failed status if all providers fail', async () => {
    provider1.setShouldFail(true);
    provider2.setShouldFail(true);
    const result = await emailService.sendEmail(emailPayload, 'id-3');
    
    expect(result.status).toBe('failed');
    expect(result.provider).toBeUndefined();
    expect(provider1.sendCalledCount).toBe(3);
    expect(provider2.sendCalledCount).toBe(3);
  });

  // Test 4: Idempotency
  it('should not send a duplicate email for the same idempotency key', async () => {
    // First successful send
    await emailService.sendEmail(emailPayload, 'id-4');
    expect(provider1.sendCalledCount).toBe(1);

    // Second attempt with same key
    const result = await emailService.sendEmail(emailPayload, 'id-4');
    expect(result.status).toBe('sent');
    expect(provider1.sendCalledCount).toBe(1); // Should not have increased
  });
  
  // Test 5: Rate Limiting (we need to manipulate time for this)
  it('should throw an error if rate limit is exceeded', async () => {
    const service = new EmailService([provider1]);
    
    // Manually setting a short rate limit window for testing
    (service as any).RATE_LIMIT_COUNT = 2;
    (service as any).RATE_LIMIT_WINDOW_MS = 10000;

    // Send 2 emails, which is the limit
    await service.sendEmail(emailPayload, 'rate-1');
    await service.sendEmail(emailPayload, 'rate-2');
    
    // The 3rd should fail
    await expect(service.sendEmail(emailPayload, 'rate-3')).rejects.toThrow('Rate limit exceeded');
  });

});
