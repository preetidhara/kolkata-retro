# Kolkata, on Repeat

A minimal YouTube playlist music player over the supplied Kolkata video.

## Setup

1. Copy `.env.example` to `.env`.
2. Add a Google Cloud API key with **YouTube Data API v3** enabled and restrict it to this site's domain.
3. Set `VITE_YOUTUBE_PLAYLIST_ID` to the playlist ID (the value after `list=` in the playlist URL).
4. Run `npm install` and `npm run dev`.

The music playback itself uses the YouTube IFrame Player API. The Data API retrieves track titles, channel names and artwork. The visible interface is entirely custom; the embedded YouTube player remains hidden.

Note: browsers require a user gesture before playing audible YouTube audio, so playback begins when the listener uses the play button.
