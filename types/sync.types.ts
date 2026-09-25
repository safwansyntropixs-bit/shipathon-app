export type OutboxItemType =
  | 'WORKOUT_SESSION'
  | 'UPDATE_PREFERENCES'
  | 'CLAIM_QUEST'
  | 'UNLOCK_TROPHY';

export type OutboxItemStatus =
  | 'queued'
  | 'syncing'
  | 'failed'
  | 'dead_letter';

export interface OutboxItem<T = any> {
  id: string; // Client-generated UUID (Crypto.randomUUID()) for idempotency
  userId: string;
  schemaVersion: number; // For backward compatibility across app updates
  type: OutboxItemType;
  payload: T;
  createdAt: string; // Exact ISO timestamp when action occurred
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  status: OutboxItemStatus; // dead_letter requires manual user intervention
}

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
  deadLetterCount: number;
}
