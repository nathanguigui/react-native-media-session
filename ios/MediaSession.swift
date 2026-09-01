import Foundation
import MediaPlayer
import AVFoundation

class MediaSession: HybridMediaSessionSpec {

    // MARK: - Listener storage

    private var playListeners: [() -> Void] = []
    private var pauseListeners: [() -> Void] = []
    private var stopListeners: [() -> Void] = []
    private var nextListeners: [() -> Void] = []
    private var previousListeners: [() -> Void] = []
    private var seekListeners: [(Double) -> Void] = []
    private var commandTargets: [Any] = []

    // MARK: - Init

    override init() {
        super.init()
        configureAudioSession()
        setupRemoteCommands()
    }

    // MARK: - Audio Session

    private func configureAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("[MediaSession] Failed to configure audio session: \(error)")
        }
    }

    // MARK: - Remote Commands

    private func setupRemoteCommands() {
        let commandCenter = MPRemoteCommandCenter.shared()

        let playTarget = commandCenter.playCommand.addTarget { [weak self] _ in
            self?.playListeners.forEach { $0() }
            return .success
        }
        commandCenter.playCommand.isEnabled = true
        commandTargets.append(playTarget)

        let pauseTarget = commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.pauseListeners.forEach { $0() }
            return .success
        }
        commandCenter.pauseCommand.isEnabled = true
        commandTargets.append(pauseTarget)

        let stopTarget = commandCenter.stopCommand.addTarget { [weak self] _ in
            self?.stopListeners.forEach { $0() }
            return .success
        }
        commandCenter.stopCommand.isEnabled = true
        commandTargets.append(stopTarget)

        let nextTarget = commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            self?.nextListeners.forEach { $0() }
            return .success
        }
        commandCenter.nextTrackCommand.isEnabled = true
        commandTargets.append(nextTarget)

        let prevTarget = commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            self?.previousListeners.forEach { $0() }
            return .success
        }
        commandCenter.previousTrackCommand.isEnabled = true
        commandTargets.append(prevTarget)

        let seekTarget = commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let positionEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            self?.seekListeners.forEach { $0(positionEvent.positionTime) }
            return .success
        }
        commandCenter.changePlaybackPositionCommand.isEnabled = true
        commandTargets.append(seekTarget)
    }

    // MARK: - Now Playing

    func updateNowPlaying(info: NowPlayingInfo) throws {
        var nowPlayingInfo: [String: Any] = [
            MPMediaItemPropertyTitle: info.title,
            MPMediaItemPropertyArtist: info.artist,
            MPMediaItemPropertyAlbumTitle: info.album,
            MPMediaItemPropertyPlaybackDuration: info.duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: info.elapsedTime,
            MPNowPlayingInfoPropertyPlaybackRate: info.speed,
        ]

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo

        if !info.artwork.isEmpty {
            loadArtwork(from: info.artwork) { artwork in
                if let artwork = artwork {
                    nowPlayingInfo[MPMediaItemPropertyArtwork] = artwork
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
                }
            }
        }
    }

    // MARK: - Playback State

    func updatePlaybackState(state: PlaybackState, elapsedTime: Double, speed: Double) throws {
        var nowPlayingInfo = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = elapsedTime
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = state == .playing ? speed : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    // MARK: - Reset

    func reset() throws {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil

        let commandCenter = MPRemoteCommandCenter.shared()
        commandCenter.playCommand.isEnabled = false
        commandCenter.pauseCommand.isEnabled = false
        commandCenter.stopCommand.isEnabled = false
        commandCenter.nextTrackCommand.isEnabled = false
        commandCenter.previousTrackCommand.isEnabled = false
        commandCenter.changePlaybackPositionCommand.isEnabled = false

        playListeners.removeAll()
        pauseListeners.removeAll()
        stopListeners.removeAll()
        nextListeners.removeAll()
        previousListeners.removeAll()
        seekListeners.removeAll()
    }

    // MARK: - Listener Registration

    func onRemotePlay(callback: @escaping () -> Void) throws {
        playListeners.append(callback)
    }
    func removeOnRemotePlay() throws {
        playListeners.removeAll()
    }

    func onRemotePause(callback: @escaping () -> Void) throws {
        pauseListeners.append(callback)
    }
    func removeOnRemotePause() throws {
        pauseListeners.removeAll()
    }

    func onRemoteStop(callback: @escaping () -> Void) throws {
        stopListeners.append(callback)
    }
    func removeOnRemoteStop() throws {
        stopListeners.removeAll()
    }

    func onRemoteNextTrack(callback: @escaping () -> Void) throws {
        nextListeners.append(callback)
    }
    func removeOnRemoteNextTrack() throws {
        nextListeners.removeAll()
    }

    func onRemotePreviousTrack(callback: @escaping () -> Void) throws {
        previousListeners.append(callback)
    }
    func removeOnRemotePreviousTrack() throws {
        previousListeners.removeAll()
    }

    func onRemoteSeek(callback: @escaping (_ position: Double) -> Void) throws {
        seekListeners.append(callback)
    }
    func removeOnRemoteSeek() throws {
        seekListeners.removeAll()
    }

    // MARK: - Artwork Loading

    private func loadArtwork(from source: String, completion: @escaping (MPMediaItemArtwork?) -> Void) {
        if source.hasPrefix("http://") || source.hasPrefix("https://") {
            guard let url = URL(string: source) else {
                completion(nil)
                return
            }
            URLSession.shared.dataTask(with: url) { data, _, error in
                guard let data = data, error == nil, let image = UIImage(data: data) else {
                    completion(nil)
                    return
                }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                DispatchQueue.main.async {
                    completion(artwork)
                }
            }.resume()
        } else {
            guard let image = UIImage(contentsOfFile: source) else {
                completion(nil)
                return
            }
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            completion(artwork)
        }
    }
}
