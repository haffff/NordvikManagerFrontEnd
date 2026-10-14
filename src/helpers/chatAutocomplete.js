// Autofill in the chat box: the chat commands while typing "/…", and player names after
// "/w ". "/c " (client commands) has its own list in ChatPanel.

export const CHAT_COMMANDS = [
  { command: "/r", description: "Roll for everyone, e.g. /r 1d20+5" },
  { command: "/gr", description: "Roll only you and the GM see" },
  { command: "/w", description: "Whisper to a player (the GM sees it too)" },
  { command: "/gm", description: "Message only the GM" },
  { command: "/help", description: "List the chat commands" },
  { command: "/c", description: "Run a client command" },
];

const WHISPER = "/w ";

/**
 * @returns {Array<{ key, label, description?, insert }> | null}
 *   null when the text is a "/c " client command (ChatPanel's own list handles it).
 */
export function getChatSuggestions(text, { players = [], meId } = {}) {
  if (text.startsWith("/c ")) return null;
  if (!text.startsWith("/")) return [];

  if (!text.includes(" ")) {
    const typed = text.toLowerCase();
    return CHAT_COMMANDS.filter((c) => c.command.startsWith(typed)).map((c) => ({
      key: c.command,
      label: c.command,
      description: c.description,
      insert: `${c.command} `,
    }));
  }

  if (text.toLowerCase().startsWith(WHISPER)) {
    const typed = text.slice(WHISPER.length).toLowerCase();
    const others = players.filter((p) => p.id !== meId && p.name);
    // Once a whole name and a space are written, the message has started.
    if (others.some((p) => typed.startsWith(`${p.name.toLowerCase()} `))) return [];
    return others
      .filter((p) => p.name.toLowerCase().startsWith(typed))
      .map((p) => ({ key: p.id, label: p.name, description: "Whisper", insert: `${WHISPER}${p.name} ` }));
  }

  return [];
}
