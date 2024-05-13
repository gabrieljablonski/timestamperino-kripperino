import 'log-timestamp'

import config from './config'
import VideoProcessingDetails from './video-processing-details'
import YouTube from './youtube'
import TwitchTv from './twitch-tv'

const videoProcessingDetails = new VideoProcessingDetails({
  filepath: config.videoProcessing.filepath,
})
const youtube = new YouTube({
  apiKey: config.youtube.apiKey,
  clientId: config.youtube.clientId,
  clientSecret: config.youtube.clientSecret,
  commenterRefreshToken: config.youtube.commenter.refreshToken,
})
const twitch = new TwitchTv({
  clientId: config.twitchTv.clientId,
  clientSecret: config.twitchTv.clientSecret,
})

const playlistId = config.youtube.uploadsPlaylistId

async function run(tries = 0) {
  if (tries >= 5) {
    return
  }

  console.info(
    `Retrieving last upload for YT playlist ${playlistId} (try #${tries + 1})`,
  )

  const lastUpload = await youtube.getLastUpload(playlistId)

  console.info(
    `Fetched last upload: ${lastUpload.snippet.title} (${lastUpload.snippet.publishedAt})`,
  )

  const videoId = lastUpload.snippet.resourceId.videoId
  if (videoProcessingDetails.processed(videoId)) {
    console.info(
      `Last upload already processed (${videoId}). Retrying in a bit...`,
    )
    // Retries up to 5 times every 30s in case the video hasn't been posted yet.
    setTimeout(() => run(tries + 1), 30 * 1000)
    return
  }

  console.info('Fetching Twitch.tv VOD...')

  const description = lastUpload.snippet.description
  const twitchVod = await twitch.getVodInfoFromText(description)
  if (!twitchVod) {
    console.info(
      `No Twitch.tv VOD found in YT video description (${description})`,
    )
  } else {
    let publishedAt = new Date(twitchVod.published_at)
    let daysAgo = Math.round(
      (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24),
    )
    let comment = `Kripp played this game live on stream about ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago (on ${publishedAt.toLocaleDateString()}). Check out the video description to see the Twitch VOD!`

    console.info(`Posting comment ('${comment}')`)

    await youtube.addComment(
      config.youtube.commenter.channelId,
      videoId,
      comment,
    )

    console.info('Comment posted')
  }

  videoProcessingDetails.update(videoId, {
    id: videoId,
    title: lastUpload.snippet.title,
    description: lastUpload.snippet.description,
    publishedAt: lastUpload.snippet.publishedAt,
    vodInfo: twitchVod
      ? {
          link: twitchVod.url,
          publishedAt: twitchVod.published_at,
        }
      : null,
  })
}

run()
