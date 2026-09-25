export interface AnalyticsEvent {
  eventName: string;
  properties: Record<string, any>;
  timestamp: number;
}

class AnalyticsRepository {
  private eventQueue: AnalyticsEvent[] = [];
  private isOptedOut: boolean = false;
  private readonly BATCH_SIZE = 5; // Reduced from 10 to flush more frequently in testing
  private currentUserId: string | null = null;
  private userTraits: Record<string, any> = {};

  setOptOut(optOut: boolean) {
    this.isOptedOut = optOut;
    if (optOut) {
      this.eventQueue = [];
    }
  }

  identify(userId: string, traits?: Record<string, any>) {
    this.currentUserId = userId;
    if (traits) {
      this.userTraits = { ...this.userTraits, ...traits };
    }
  }

  async saveEvent(event: AnalyticsEvent) {
    if (this.isOptedOut) return;
    
    // Inject user context if available
    if (this.currentUserId) {
      event.properties = {
        ...event.properties,
        user_id: this.currentUserId,
      };
    }

    this.eventQueue.push(event);

    if (this.eventQueue.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  async flush() {
    if (this.eventQueue.length === 0) return;
    
    const batch = [...this.eventQueue];
    this.eventQueue = [];

    // Simulate network latency for batch transmission to Firebase/PostHog
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log(`[AnalyticsRepository] Flushed ${batch.length} events to telemetry providers.`);
  }
}

export const analyticsRepository = new AnalyticsRepository();
