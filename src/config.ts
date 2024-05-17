// NOTE: Kripp's timezone. Setting it on `.env` is unreliable.
process.env.TZ = 'America/Toronto'

export default {
  env: process.env.NODE_ENV ?? 'development',
  videoProcessing: {
    filepath: process.env.VIDEO_PROCESSING_FILEPATH ?? '',
  },
  youtube: {
    commenter: {
      channelId: process.env.YOUTUBE_COMMENTER_CHANNEL_ID ?? '',
      refreshToken: process.env.YOUTUBE_COMMENTER_REFRESH_TOKEN ?? '',
    },
    uploadsPlaylistId: process.env.YOUTUBE_UPLOADS_PLAYLIST_ID ?? '',
    apiKey: process.env.YOUTUBE_API_KEY ?? '',
    clientId: process.env.YOUTUBE_CLIENT_ID ?? '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
  },
  twitchTv: {
    clientId: process.env.TWITCH_CLIENT_ID ?? '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '',
  },
}
