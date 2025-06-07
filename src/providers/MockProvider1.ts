import { IEmailProvider, EmailPayload } from '../interfaces/IEmailProvider';

// Simulates a provider that might fail
export class MockProvider1 implements IEmailProvider {
  private name = 'MailGun-Simulator';

  public getName(): string {
    return this.name;
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; providerName: string }> {
    console.log(`Attempting to send email via ${this.name}...`);
    return new Promise((resolve, reject) => {
      // Simulate network delay and potential failure (50% chance of failure)
      setTimeout(() => {
        if (Math.random() > 0.5) {
          console.log(`✅ Email sent successfully via ${this.name}.`);
          resolve({ success: true, providerName: this.name });
        } else {
          console.log(`❌ Failed to send email via ${this.name}.`);
          reject(new Error('Provider request failed'));
        }
      }, 500);
    });
  }
}