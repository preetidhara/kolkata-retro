import './style.css';

const placeholderArtwork = "placeholder.png"

const config = {
  apiKey: import.meta.env.VITE_YOUTUBE_API_KEY,
  playlistId: import.meta.env.VITE_YOUTUBE_PLAYLIST_ID,
};

const $ = (id) => document.getElementById(id);
const ui = {
  artwork: $('artwork'), name: $('track-name'), artist: $('track-artist'), progress: $('progress'),
  current: $('current-time'), duration: $('duration'), play: $('play-pause'), playIcon: $('play-icon'),
  pauseIcon: $('pause-icon'), message: $('player-message'), previous: $('previous'), next: $('next'), repeat: $('repeat'),
};
let tracks = [], currentIndex = 0, player, playerReady = false, isSeeking = false, ticker, blockedTracks = 0, repeatMode = false, hasUserStartedPlayback = false, lastControlInteraction = 0;

function seconds(iso = '') {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return match ? (+match[1] || 0) * 3600 + (+match[2] || 0) * 60 + (+match[3] || 0) : 0;
}
function formatTime(value) {
  value = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
function setPlaying(playing) {
  ui.playIcon.classList.toggle('hidden', playing); ui.pauseIcon.classList.toggle('hidden', !playing);
  ui.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  ui.artwork.parentElement.classList.toggle('is-playing', playing);
}
function setProgress(value) {
  const percent = Math.min(100, Math.max(0, value || 0));
  ui.progress.value = percent;
  ui.progress.style.setProperty('--fill', `${percent}%`);
}
function renderTrack() {
  const track = tracks[currentIndex]; if (!track) return;
  ui.name.textContent = track.title; ui.artist.textContent = track.artist;
  ui.artwork.src = track.thumbnail || placeholderArtwork; ui.artwork.alt = `${track.title} artwork`;
  ui.duration.textContent = formatTime(track.duration); ui.current.textContent = '0:00'; setProgress(0);
}
async function getTracks() {
  if (!config.apiKey || !config.playlistId) {
    ui.name.textContent = 'Set up your playlist';
    ui.artist.textContent = 'Add VITE_YOUTUBE_API_KEY and VITE_YOUTUBE_PLAYLIST_ID to .env';
    ui.message.textContent = 'Configuration required'; return;
  }
  try {
    const base = 'https://www.googleapis.com/youtube/v3/playlistItems';
    const response = await fetch(`${base}?part=snippet,contentDetails&maxResults=50&playlistId=${encodeURIComponent(config.playlistId)}&key=${config.apiKey}`);
    if (!response.ok) throw new Error('Unable to fetch the playlist');
    const items = (await response.json()).items.filter((item) => item.snippet.resourceId?.videoId);
    const ids = items.map((item) => item.snippet.resourceId.videoId).join(',');
    const detailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${config.apiKey}`);
    const durations = new Map((await detailsResponse.json()).items.map((video) => [video.id, seconds(video.contentDetails.duration)]));
    tracks = items.map((item) => ({
      id: item.snippet.resourceId.videoId, title: item.snippet.title, artist: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      duration: durations.get(item.snippet.resourceId.videoId) || 0,
    }));
    if (!tracks.length) throw new Error('No playable videos were found');
    renderTrack(); createPlayer();
  } catch (error) {
    ui.name.textContent = 'Playlist unavailable'; ui.artist.textContent = error.message;
    ui.message.textContent = 'Check the API key and playlist ID.';
  }
}
function createPlayer() {
  window.onYouTubeIframeAPIReady = () => {
    player = new window.YT.Player('youtube-player', {
      // YouTube's IFrame API requires a minimum 200 × 200 player surface.
      // It is positioned off-screen by CSS; the visible player remains custom.
      height: '200', width: '200', videoId: tracks[0].id,
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0, origin: window.location.origin },
      events: {
        onReady: () => { playerReady = true; player.pauseVideo(); player.seekTo(0, true); },
        onStateChange: onPlayerStateChange,
        onError: (event) => {
          blockedTracks += 1;
          if (blockedTracks < tracks.length) {
            ui.message.textContent = 'This video is unavailable for embedded playback. Trying the next track…';
            window.setTimeout(() => changeTrack(1, true), 250);
          } else {
            ui.message.textContent = `No tracks in this playlist allow embedded playback (YouTube error ${event.data}).`;
            setPlaying(false);
          }
        },
      },
    });
  };
  const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; document.head.append(script);
}
function onPlayerStateChange(event) {
  if (event.data === window.YT.PlayerState.PLAYING) {
    if (!hasUserStartedPlayback) { player.pauseVideo(); return; }
    blockedTracks = 0; setPlaying(true); ui.message.textContent = '';
  }
  if (event.data === window.YT.PlayerState.PAUSED) setPlaying(false);
  if (event.data === window.YT.PlayerState.ENDED) {
    if (repeatMode) { player.seekTo(0, true); player.playVideo(); }
    else changeTrack(1, true);
  }
}
function changeTrack(step, shouldPlay = false) {
  if (!tracks.length || !playerReady) return;
  currentIndex = (currentIndex + step + tracks.length) % tracks.length;
  renderTrack();
  player.loadVideoById(tracks[currentIndex].id);
  if (!shouldPlay) player.pauseVideo();
}
function togglePlayback() {
  if (!playerReady || !tracks.length) return;
  const playing = player.getPlayerState() === window.YT.PlayerState.PLAYING;
  if (playing) player.pauseVideo();
  else { hasUserStartedPlayback = true; player.playVideo(); }
}
function tick() {
  if (playerReady && !isSeeking) {
    const now = player.getCurrentTime(), total = player.getDuration() || tracks[currentIndex]?.duration || 0;
    ui.current.textContent = formatTime(now); ui.duration.textContent = formatTime(total);
    setProgress(total ? (now / total) * 100 : 0);
  }
}
function updateClock() { $('clock').textContent = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date()); }

ui.artwork.addEventListener('error', () => { ui.artwork.src = placeholderArtwork; });
function runFromUserGesture(action) {
  const now = performance.now();
  if (now - lastControlInteraction < 350) return;
  lastControlInteraction = now;
  action();
}
function bindPlaybackControl(element, action) {
  element.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    runFromUserGesture(action);
  });
  element.addEventListener('click', () => runFromUserGesture(action));
}
bindPlaybackControl(ui.play, togglePlayback);
bindPlaybackControl(ui.previous, () => { hasUserStartedPlayback = true; changeTrack(-1, true); });
bindPlaybackControl(ui.next, () => { hasUserStartedPlayback = true; changeTrack(1, true); });
ui.repeat.addEventListener('click', () => { repeatMode = !repeatMode; ui.repeat.classList.toggle('active', repeatMode); ui.repeat.setAttribute('aria-pressed', String(repeatMode)); ui.repeat.setAttribute('aria-label', `Repeat ${repeatMode ? 'on' : 'off'}`); });
ui.progress.addEventListener('pointerdown', () => { isSeeking = true; });
ui.progress.addEventListener('input', () => { const total = player?.getDuration() || tracks[currentIndex]?.duration || 0; setProgress(ui.progress.value); ui.current.textContent = formatTime(total * ui.progress.value / 100); });
ui.progress.addEventListener('change', () => { const total = player?.getDuration() || tracks[currentIndex]?.duration || 0; player?.seekTo(total * ui.progress.value / 100, true); isSeeking = false; });
updateClock(); setInterval(updateClock, 30000); ticker = setInterval(tick, 300); getTracks();
