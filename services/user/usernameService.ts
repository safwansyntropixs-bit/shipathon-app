import { supabase } from "@/utils/supabase";

export interface UsernameCheckResult {
  isAvailable: boolean;
  message: string;
  isValidFormat: boolean;
}

export const usernameService = {
  formatUsername(input: string): string {
    return input
      .toLowerCase()
      .replace(/^@+/, "") // Remove leading @
      .replace(/[^a-z0-9_]/g, ""); // Allow only lowercase letters, numbers, and underscores
  },

  validateFormat(username: string): { isValid: boolean; message: string } {
    const formatted = this.formatUsername(username);
    if (!formatted) {
      return { isValid: false, message: "Username cannot be empty" };
    }
    if (formatted.length < 3) {
      return { isValid: false, message: "Username must be at least 3 characters" };
    }
    if (formatted.length > 15) {
      return { isValid: false, message: "Username cannot exceed 15 characters" };
    }
    const regex = /^[a-z0-9_]+$/;
    if (!regex.test(formatted)) {
      return { isValid: false, message: "Only letters, numbers & underscores allowed" };
    }
    return { isValid: true, message: "Format valid" };
  },

  async checkAvailability(
    username: string,
    currentUserId?: string
  ): Promise<UsernameCheckResult> {
    const cleanUsername = this.formatUsername(username);
    const formatCheck = this.validateFormat(cleanUsername);

    if (!formatCheck.isValid) {
      return {
        isAvailable: false,
        isValidFormat: false,
        message: formatCheck.message,
      };
    }

    try {
      let query = supabase
        .from("profiles")
        .select("id")
        .ilike("username", cleanUsername);

      if (currentUserId) {
        query = query.neq("id", currentUserId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        return {
          isAvailable: false,
          isValidFormat: true,
          message: `@${cleanUsername} is already taken`,
        };
      }

      return {
        isAvailable: true,
        isValidFormat: true,
        message: `@${cleanUsername} is available!`,
      };
    } catch (err: any) {
      console.error("Error checking username availability:", err);
      return {
        isAvailable: false,
        isValidFormat: true,
        message: "Failed to verify username availability",
      };
    }
  },
};
