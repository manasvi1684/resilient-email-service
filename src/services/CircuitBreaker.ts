// src/services/CircuitBreaker.ts

import { IEmailProvider, EmailPayload } from '../interfaces/IEmailProvider';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private provider: IEmailProvider;
  private state: CircuitState = 'CLOSED';

  // The number of failures before the circuit opens
  private failureThreshold = 3;
  // The time in ms to wait before moving from OPEN to HALF_OPEN
  private resetTimeout = 30000; // 30 seconds

  private failureCount = 0;
  private lastFailureTime: number = 0;
  private halfOpenRequestPending = false;

  constructor(provider: IEmailProvider) {
    this.provider = provider;
  }

  public getName(): string {
    return this.provider.getName();
  }

  public async send(payload: EmailPayload): Promise<{ success: boolean; providerName: string }> {
    // --- Check the state of the circuit ---
    if (this.state === 'OPEN') {
      // If the circuit is OPEN, check if the reset timeout has passed
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenRequestPending = false; // Reset for the new half-open state
        console.warn(`[CircuitBreaker] Circuit for ${this.getName()} is now HALF_OPEN.`);
      } else {
        // If timeout has not passed, reject the request immediately
        throw new Error(`[CircuitBreaker] Circuit for ${this.getName()} is OPEN. Rejecting request.`);
      }
    }

    // --- In CLOSED or HALF_OPEN state, attempt the request ---
    // Prevent multiple concurrent requests in HALF_OPEN state
    if (this.state === 'HALF_OPEN' && this.halfOpenRequestPending) {
        throw new Error(`[CircuitBreaker] Circuit for ${this.getName()} is HALF_OPEN. A test request is already in progress.`);
    }
    if(this.state === 'HALF_OPEN') {
        this.halfOpenRequestPending = true;
    }


    try {
      const result = await this.provider.send(payload);
      // If the request was successful, reset the circuit
      this.reset();
      return result;
    } catch (error) {
      // If the request failed, record the failure
      this.recordFailure();
      // Re-throw the original error to be handled by the EmailService
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.halfOpenRequestPending = false; // The half-open request failed

    // If the failure count exceeds the threshold, open the circuit
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error(`[CircuitBreaker] Circuit for ${this.getName()} is now OPEN due to ${this.failureCount} failures.`);
    }
  }

  private reset(): void {
    if (this.state !== 'CLOSED') {
        console.log(`[CircuitBreaker] Circuit for ${this.getName()} has been reset to CLOSED.`);
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.halfOpenRequestPending = false;
  }
}