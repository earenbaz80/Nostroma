/**
 * What a chat sends for a message.
 *
 * Mission mode turns the message into a goal: that turn runs with full access
 * and the assistant keeps working until the goal is done. A command the person
 * typed (anything starting with `/`) is sent exactly as it is, so `/plan`,
 * `/compact` and the rest keep working inside the mode.
 */
export function outgoingMessage(typed: string, message: string, mission: boolean): string {
  return mission && !typed.startsWith('/') ? `/goal ${message}` : message;
}
