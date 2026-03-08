# react-native-media-session

Expose native media controls (iOS Lock Screen / Control Center, Android MediaStyle notification) to React Native. Built with [Nitro Modules](https://nitro.margelo.com/) for synchronous, type-safe native bridging.

Designed to coexist with any audio library — just wire up the remote commands to your player of choice.

## Installation

```sh
npm install react-native-media-session react-native-nitro-modules
```

> `react-native-nitro-modules` is a required peer dependency.

### iOS

Add **Background Modes > Audio** to your Xcode project capabilities.

### Android

If targeting Android 13+, request the `POST_NOTIFICATIONS` permission at runtime in your app.

## Usage

```ts
import { MediaSession } from 'react-native-media-session';

// Set now-playing metadata
MediaSession.updateNowPlaying({
  title: 'Song Title',
  artist: 'Artist',
  album: 'Album',
  artwork: 'https://example.com/cover.jpg', // URL or local file path
  duration: 240,
  elapsedTime: 0,
  speed: 1.0,
});

// Update playback state
MediaSession.updatePlaybackState('playing', 42, 1.0);

// Listen to remote commands (lock screen / notification controls)
MediaSession.onRemotePlay(() => player.play());
MediaSession.onRemotePause(() => player.pause());
MediaSession.onRemoteStop(() => player.stop());
MediaSession.onRemoteNextTrack(() => player.next());
MediaSession.onRemotePreviousTrack(() => player.previous());
MediaSession.onRemoteSeek((position) => player.seekTo(position));

// Clear metadata and disable controls
MediaSession.reset();
```

## API

### `updateNowPlaying(info: NowPlayingInfo)`

Set the metadata displayed on the lock screen / notification.

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Track title |
| `artist` | `string` | Artist name |
| `album` | `string` | Album name |
| `artwork` | `string` | Image URL or local file path (empty string = no artwork) |
| `duration` | `number` | Total duration in seconds |
| `elapsedTime` | `number` | Current position in seconds |
| `speed` | `number` | Playback rate (1.0 = normal) |

### `updatePlaybackState(state, elapsedTime, speed)`

Update the playback state and position.

- `state`: `'playing' | 'paused' | 'stopped' | 'buffering'`
- `elapsedTime`: current position in seconds
- `speed`: playback rate

### `reset()`

Clear all metadata, disable remote commands, and remove the notification (Android).

### Remote command listeners

| Method | Callback signature |
|---|---|
| `onRemotePlay(cb)` | `() => void` |
| `onRemotePause(cb)` | `() => void` |
| `onRemoteStop(cb)` | `() => void` |
| `onRemoteNextTrack(cb)` | `() => void` |
| `onRemotePreviousTrack(cb)` | `() => void` |
| `onRemoteSeek(cb)` | `(position: number) => void` |

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
