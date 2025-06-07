// src/services/EmailService.ts

import { IEmailProvider, EmailPayload } from '../interfaces/IEmailProvider';
import { v4 as uuidv4 } from 'uuid';
import { CircuitBreaker } from './CircuitBreaker';

type EmailStatus = 'pending' | 'sent' | 'failed';

export interface TrackedEmail {
  id: string;
  status: EmailStatus;
  attempts: number;
  provider?: string;
  lastAttempt: Date;
  idempotencyKey: string;
}

export class EmailService {
  private providers: IEmailProvider[];
  private sentEmailIds = new Set<string>(); // For Idempotency
  private emailStatus = new Map<string, TrackedEmail>(); // For Status Tracking

  // For Rate Limiting: 5 emails per 10 seconds
  private requestTimestamps: number[] = [];
  private readonly RATE_LIMIT_COUNT = 5;
  private readonly RATE_LIMIT_WINDOW_MS = 10000;
  private readonly MAX_RETRIES = 2; // e.g., 1 initial try + 2 retries = 3 total attempts per provider

  constructor(providers: IEmailProvider[]) {
    if (!providers || providers.length === 0) {
      throw new Error('EmailService requires at least one provider.');
    }
     // Wrap each provider in a CircuitBreaker
    this.providers = providers.map(p => new CircuitBreaker(p));
  }

  // Utility function for adding delay (Exponential Backoff)
  private wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRateLimited(): boolean {
    const now = Date.now();
    // Remove timestamps older than our window
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.RATE_LIMIT_WINDOW_MS
    );
    // Check if we are over the limit
    if (this.requestTimestamps.length >= this.RATE_LIMIT_COUNT) {
      console.warn('Rate limit exceeded. Please wait before sending more emails.');
      return true;
    }
    return false;
  }

  public async sendEmail(payload: EmailPayload, idempotencyKey: string): Promise<TrackedEmail> {
    // 1. Idempotency Check
    if (this.sentEmailIds.has(idempotencyKey)) {
      console.log(`Idempotency key ${idempotencyKey} already processed. Skipping.`);
      return this.emailStatus.get(idempotencyKey)!;
    }

    // 2. Rate Limiting Check
    if (this.isRateLimited()) {
      // In a real app, you might queue this or throw a specific error.
      // For now, we throw an error.
      throw new Error('Rate limit exceeded. Try again later.');
    }
    this.requestTimestamps.push(Date.now()); // Log the request time only if not limited

    // 3. Status Tracking Initialization
    const trackedEmail: TrackedEmail = {
      id: uuidv4(),
      status: 'pending',
      attempts: 0,
      lastAttempt: new Date(),
      idempotencyKey: idempotencyKey,
    };
    this.emailStatus.set(idempotencyKey, trackedEmail);

    // 4. Retry and Fallback Logic
    for (const provider of this.providers) {
      for (let i = 0; i <= this.MAX_RETRIES; i++) {
        try {
          console.log(`Attempt #${i + 1} with provider ${provider.getName()}...`);
          trackedEmail.attempts++;
          trackedEmail.lastAttempt = new Date();

          const result = await provider.send(payload);

          if (result.success) {
            console.log(`Successfully sent email with ${result.providerName}`);
            trackedEmail.status = 'sent';
            trackedEmail.provider = result.providerName;
            this.sentEmailIds.add(idempotencyKey); // Mark as sent for idempotency
            this.emailStatus.set(idempotencyKey, trackedEmail);
            return trackedEmail;
          }
        } catch (error) {
          console.error(`Attempt #${i + 1} with ${provider.getName()} failed:`, (error as Error).message);
          if (i < this.MAX_RETRIES) {
            const delay = Math.pow(2, i) * 200; // Exponential backoff: 200ms, 400ms, 800ms...
            console.log(`Retrying in ${delay}ms...`);
            await this.wait(delay);
          }
        }
      }
      console.warn(`Provider ${provider.getName()} failed after all retries. Falling back to the next provider.`);
    }

    // 5. Final Failure
    console.error(`All providers failed for idempotency key: ${idempotencyKey}.`);
    trackedEmail.status = 'failed';
    this.emailStatus.set(idempotencyKey, trackedEmail);
    return trackedEmail;
  }
  
  // Public method for status tracking
  public getEmailStatus(idempotencyKey: string): TrackedEmail | undefined {
      return this.emailStatus.get(idempotencyKey);
  }
}