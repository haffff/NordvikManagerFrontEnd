import { ActiveWebHelper as WebHelper } from "../../helpers/transport";

// Playlist/Soundboard CRUD and playback, as a ClientMediator client instead of
// handler functions private to PlaylistsPanel/SoundboardPanel. Registered once
// by PlaybackManager (always-mounted, see Game.js) so any code — keyboard
// shortcuts, addons, the Run dialog, another panel — can reach
// ClientMediator.sendCommandAsync("Playlist", "Play", { playlistId }) even
// when neither panel is open, instead of only from inside their own button
// handlers.
export const PlaylistService = {
  panel: "Playlist",
  id: "PlaylistService",

  // ── $meta: command documentation ─────────────────────────────────────────────
  // Consumed by CommandExecutionHelper.LoadSuggestions to build rich suggestions
  // (description + typed arg list) for the QuickCommandDialog / Run panel — same
  // convention as useGameApi's "Game" client.
  $meta: {
    GetPlaylists: {
      description: 'Fetches playlists/soundboards for this game. kind: 0 = music playlist, 1 = soundboard.',
      args: [{ name: 'kind', type: 'number', required: false }],
    },
    GetCurrentPlayback: {
      description: 'Returns the array of currently playing/paused playlist states.',
      args: [],
    },
    AddPlaylist: {
      description: 'Creates a new playlist or soundboard. Returns { status, body } — body.id on success.',
      args: [{ name: 'data', type: 'object', required: true }],
    },
    UpdatePlaylist: {
      description: 'Updates an existing playlist/soundboard (name, tracks, mode, etc).',
      args: [{ name: 'data', type: 'object', required: true }],
    },
    SetVolume: {
      description: "Sets a playlist's or soundboard's volume (0..1) for everyone; heard at once while it plays. Each player's own volume applies on top.",
      args: [{ name: 'playlist', type: 'object', required: true }, { name: 'volume', type: 'number', required: true }],
    },
    RemovePlaylist: {
      description: 'Deletes a playlist/soundboard by ID.',
      args: [{ name: 'id', type: 'string', required: true }],
    },
    Play: {
      description: 'Plays (or resumes) a music playlist by ID.',
      args: [{ name: 'playlistId', type: 'playlistid', required: true }],
    },
    Pause: {
      description: 'Pauses a currently playing music playlist by ID.',
      args: [{ name: 'playlistId', type: 'playlistid', required: true }],
    },
    Stop: {
      description: 'Stops a music playlist by ID and tears down its playback state.',
      args: [{ name: 'playlistId', type: 'playlistid', required: true }],
    },
    SetLoopedSounds: {
      description: "Sets which of a soundboard's sounds repeat until stopped (resource IDs); they loop from their next play.",
      args: [{ name: 'playlist', type: 'object', required: true }, { name: 'resourceIds', type: 'array', required: true }],
    },
    PlaySound: {
      description: "Plays a soundboard sound by resource ID. soundboardId (optional): the soundboard it's from, whose volume applies and which may loop it.",
      args: [{ name: 'resourceId', type: 'audioresourceid', required: true }, { name: 'soundboardId', type: 'string', required: false }],
    },
    StopSound: {
      description: 'Stops a currently playing soundboard sound by resource ID.',
      args: [{ name: 'resourceId', type: 'audioresourceid', required: true }],
    },
    StopAllSounds: {
      description: 'Stops every soundboard sound playing, for everyone.',
      args: [],
    },
  },

  // ── CRUD (kind: 0 = music playlist, 1 = soundboard) ─────────────────────────
  GetPlaylists: ({ kind = 0 } = {}) => WebHelper.getAsync(`Playlist/GetPlaylists?kind=${kind}`),
  GetCurrentPlayback: () => WebHelper.getAsync("Playlist/GetCurrentPlayback"),
  AddPlaylist: (data) => WebHelper.postAsync("Playlist/AddPlaylist", data),
  UpdatePlaylist: (data) => WebHelper.putAsync("Playlist/UpdatePlaylist", data),
  SetVolume: ({ playlist, volume }) => updateOne(playlist, { Volume: volume }),
  SetLoopedSounds: ({ playlist, resourceIds }) => updateOne(playlist, { LoopedResourceIds: resourceIds }),
  // Accepts either a bare id (direct panel calls) or { id } (CommandExecutionHelper
  // wraps positional Run-dialog args into { [metaArgName]: value }) — same dual-shape
  // handling as useGameApi's GetPlayer.
  RemovePlaylist: (idOrObj) => WebHelper.deleteAsync("Playlist/RemovePlaylist", idOrObj?.id ?? idOrObj),

  // ── Playlist playback ────────────────────────────────────────────────────────
  Play: ({ playlistId }) => WebHelper.postAsync("Playlist/PlayPlaylist", { PlaylistId: playlistId }),
  Pause: ({ playlistId }) => WebHelper.postAsync("Playlist/PausePlaylist", { PlaylistId: playlistId }),
  Stop: ({ playlistId }) => WebHelper.postAsync("Playlist/StopPlaylist", { PlaylistId: playlistId }),

  // ── Soundboard one-shots ─────────────────────────────────────────────────────
  PlaySound: ({ resourceId, soundboardId }) => WebHelper.postAsync("Soundboard/PlaySound",
    soundboardId ? { ResourceId: resourceId, SoundboardId: soundboardId } : { ResourceId: resourceId }),
  StopSound: ({ resourceId }) => WebHelper.postAsync("Soundboard/StopSound", { ResourceId: resourceId }),
  StopAllSounds: () => WebHelper.postAsync("Soundboard/StopAllSounds", {}),
};

// Changes one thing of a playlist: UpdatePlaylist replaces the whole playlist, so
// everything else is sent unchanged.
function updateOne(playlist, change) {
  return WebHelper.putAsync("Playlist/UpdatePlaylist", {
    Id: playlist.id,
    Name: playlist.name,
    Description: playlist.description ?? "",
    Mode: Number(playlist.mode ?? 0),
    Shuffle: playlist.shuffle ?? false,
    Repeat: playlist.repeat ?? true,
    Kind: Number(playlist.kind ?? 0),
    ResourceIds: (playlist.resources ?? []).map((r) => r.id),
    ...change,
  });
}

export default PlaylistService;
