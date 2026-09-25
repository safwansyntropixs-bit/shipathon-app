import { supabase } from "@/utils/supabase";

export interface WorkoutPayload {
  user_id: string;
  exercise_type: string;
  duration_seconds: number;
  target_reps: number;
  target_seconds: number;
  valid_rep_count: number;
  valid_active_seconds: number;
  is_ended_early: boolean;
  form_accuracy: number;
}

export const workoutRepository = {
  /**
   * Logs a completed workout session via secure Supabase RPC.
   * Returns the generated workout ID and earned XP.
   */
  async insertWorkoutSession(payload: WorkoutPayload): Promise<{ workout_id: string; earned_xp: number; streak_bonus_xp: number; streak_days: number } | null> {
    const workoutId = (payload as any).id || (payload as any).workout_id;
    const createdAt = (payload as any).created_at || new Date().toISOString();

    try {
      const { data, error } = await supabase.rpc('log_workout_session', {
        p_user_id: payload.user_id,
        p_exercise_type: payload.exercise_type,
        p_duration_seconds: Math.round(payload.duration_seconds || 0),
        p_valid_rep_count: Math.round(payload.valid_rep_count || 0),
        p_valid_active_seconds: Math.round(payload.valid_active_seconds || 0),
        p_form_accuracy: Number(payload.form_accuracy) || 0,
        p_target_reps: Math.round(payload.target_reps || 0),
        p_target_seconds: Math.round(payload.target_seconds || 0),
        p_is_ended_early: Boolean(payload.is_ended_early),
        p_workout_id: workoutId,
        p_created_at: createdAt
      }).single();

      if (!error && data) {
        return data as { workout_id: string; earned_xp: number; streak_bonus_xp: number; streak_days: number } | null;
      }
      if (error) {
        console.warn("[workoutRepository] log_workout_session RPC error, falling back to direct table insert:", error);
      }
    } catch (rpcErr) {
      console.warn("[workoutRepository] log_workout_session RPC exception, falling back to direct table insert:", rpcErr);
    }

    // Direct table insert fallback with UUID idempotency
    const insertObj: any = {
      user_id: payload.user_id,
      exercise_type: payload.exercise_type,
      duration_seconds: Math.round(payload.duration_seconds || 0),
      target_reps: Math.round(payload.target_reps || 0),
      target_seconds: Math.round(payload.target_seconds || 0),
      valid_rep_count: Math.round(payload.valid_rep_count || 0),
      valid_active_seconds: Math.round(payload.valid_active_seconds || 0),
      is_ended_early: Boolean(payload.is_ended_early),
      form_accuracy: Number(payload.form_accuracy) || 0,
      created_at: createdAt
    };

    if (workoutId) {
      insertObj.id = workoutId;
    }

    const { data: insertData, error: insertError } = await supabase
      .from('workouts')
      .upsert(insertObj, { onConflict: 'id', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();

    if (insertError) {
      console.error("[workoutRepository] direct insert error:", insertError);
      throw insertError;
    }

    return {
      workout_id: insertData?.id || workoutId,
      earned_xp: payload.valid_rep_count > 0 ? payload.valid_rep_count : Math.round(payload.valid_active_seconds / 4),
      streak_bonus_xp: 0,
      streak_days: 1
    };
  },
};
