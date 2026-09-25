import { syncQueueService } from "../core/syncQueueService";
import { WorkoutPayload } from "../../repositories/workout/workoutRepository";
import { OutboxItem } from "../../types/sync.types";

export interface ExtendedWorkoutPayload extends WorkoutPayload {
  workout_id?: string;
  created_at?: string;
  schema_version?: number;
}

export const workoutService = {
  /**
   * Saves a completed workout session to the offline outbox queue first.
   * Guarantees atomic disk write before background sync.
   * If the device disk is full, the quota exception halts the flow cleanly.
   */
  async saveWorkoutSession(
    payload: ExtendedWorkoutPayload,
    sessionId?: string,
    createdAt?: string
  ): Promise<OutboxItem<ExtendedWorkoutPayload>> {
    const workoutId = sessionId || payload.workout_id;
    const timestamp = createdAt || payload.created_at || new Date().toISOString();

    const formattedPayload: ExtendedWorkoutPayload = {
      ...payload,
      workout_id: workoutId,
      created_at: timestamp,
      schema_version: 1,
    };

    return await syncQueueService.enqueue({
      id: workoutId,
      userId: payload.user_id,
      type: "WORKOUT_SESSION",
      payload: formattedPayload,
      createdAt: timestamp,
      schemaVersion: 1,
    });
  },
};
