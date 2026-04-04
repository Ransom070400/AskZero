// Basic input sanitization and content moderation

const MAX_MESSAGE_LENGTH = 10_000;

export function sanitizeInput(text: string): string {
  return text.slice(0, MAX_MESSAGE_LENGTH).trim();
}

export function validateMessage(text: string): {
  valid: boolean;
  error?: string;
} {
  if (!text || !text.trim()) {
    return { valid: false, error: "Message cannot be empty" };
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
    };
  }
  return { valid: true };
}
