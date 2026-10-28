// Whispers and GM rolls (/w, /gm, /gr): the server sets recipientId on them and only
// delivers them to the sender, the recipient and the GM. This names them for the chat.

const isRoll = (data) => {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return parsed?.type === "Roll";
  } catch {
    return false;
  }
};

/**
 * @returns {{ label: string } | null} null for an ordinary (public) message.
 */
export function describePrivacy(item, { players = [], meId, gmId } = {}) {
  const recipientId = item?.recipientId;
  if (!recipientId) return null;

  const name = (id) => players.find((p) => p.id === id)?.name ?? "[Unknown]";

  if (recipientId === gmId && isRoll(item.data)) return { label: "GM roll" };
  if (item.playerId === meId) {
    return { label: recipientId === gmId ? "Whisper to the GM" : `Whisper to ${name(recipientId)}` };
  }
  if (recipientId === meId) return { label: `Whisper from ${name(item.playerId)}` };
  return { label: `${name(item.playerId)} → ${name(recipientId)}` };
}
