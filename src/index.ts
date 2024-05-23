import 'log-timestamp'
import path from 'path'

import config from './config'
import VideoProcessingDetails from './video-processing-details'
import YouTube from './youtube'
import TwitchTv from './twitch-tv'
import OCR from './ocr'
import { listFilesInDirectory } from './files'

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
const ocr = new OCR()

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

    // NOTE: Retries up to 5 times every 30s in case the video hasn't been posted yet.
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
    const publishedAt = new Date(twitchVod.published_at)
    const daysAgo = Math.round(
      (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24),
    )

    const commentLines = [
      `Kripp played this game live on stream about ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago (on ${publishedAt.toLocaleDateString()}).`,
    ]
    try {
      console.info('Downloading YT video')

      const videosPath = 'videos/'
      await youtube.downloadVideo(videoId, {
        from: 30,
        to: 180,
        format: '247',
        outputPath: videosPath,
      })

      console.info('Extracting images from YT video')

      const filepath = path.join(videosPath, `${videoId}.webm`)
      const imagesPath = 'images/'
      await ocr.videoToImages(filepath, {
        outputPath: imagesPath,
        crop: { x: 63, y: 693, w: 130, h: 20 },
      })

      const files = listFilesInDirectory(imagesPath)
      files.sort()

      let time: [number, number] | null = null
      for (const file of files) {
        let text = await ocr.imageToText(path.join(imagesPath, file), 7)
        console.log(file, text)
        let match = text.trim().match(/(\d\d?):(\d\d) ?([AP]M)/)
        if (!match) {
          text = await ocr.imageToText(path.join(imagesPath, file), 13)
          match = text.trim().match(/(\d\d?):(\d\d) ?([AP]M)/)
        }
        console.log(file, text)
        if (match) {
          const offset = match[3] === 'PM' ? 12 : 0
          time = [Number(match[1]) + offset, Number(match[2])]

          if (time[0] === 12 && match[3] === 'AM') {
            // NOTE: Hearthstone clock uses 12:XX AM for midnight
            time[0] = 0
          }

          if (time[0] === 24) {
            // NOTE: Hearthstone clock uses 12:XX PM for noon
            time[0] = 12
          }

          console.info(`Found timestamp: ${text.trim()} in ${file}`)
          break
        }
      }

      if (!time) {
        throw new Error('no timestamp found in images')
      }

      const detectedTime = new Date(publishedAt)
      // NOTE: `process.env.TZ` needs to be set to Kripp's timezone (usually `America/Toronto`, unless he's on a trip) for the time to be set correctly.
      detectedTime.setHours(time[0])
      detectedTime.setMinutes(time[1])

      let diff = (detectedTime.getTime() - publishedAt.getTime()) / 1000
      if (diff < 0) {
        // NOTE: Detected time is from the next day.
        diff += 24 * 60 * 60
      }

      const vodDurationMatch = twitchVod.duration.match(
        /(?:(\d\d?)h)?(?:(\d\d?)m)?(?:(\d\d?)s)/,
      )

      if (!vodDurationMatch) {
        throw new Error('failed to parse VOD duration')
      }

      const vodDurationHours = Number(vodDurationMatch[1])
      const vodDurationMinutes = Number(vodDurationMatch[2])
      const vodDurationSeconds = Number(vodDurationMatch[3])
      const vodDuration =
        vodDurationHours * 3600 + vodDurationMinutes * 60 + vodDurationSeconds

      const diffHours = Math.floor(diff / 3600)
      const diffMinutes = Math.floor((diff % 3600) / 60)
      const diffSeconds = Math.floor(diff % 60)

      const pad = (num: number) => num.toString().padStart(2, '0')
      const timestamp = `${pad(diffHours)}:${pad(diffMinutes)}:${pad(diffSeconds)}`

      if (diff > vodDuration) {
        throw new Error(
          `detected time is after VOD duration (${timestamp} > ${twitchVod.duration})`,
        )
      }

      commentLines.push(
        `It seems the game starts at around ${timestamp} in the Twitch VOD. Check the video description for the link!`,
      )
    } catch (error) {
      console.error('Failed to process video:', error)

      commentLines.push(
        'Check out the video description to see the Twitch VOD!',
      )
    }

    console.info('Posting comment:', commentLines)

    if (config.env === 'production') {
      await youtube.addComment(
        config.youtube.commenter.channelId,
        videoId,
        commentLines.join('\n'),
      )

      console.info('Comment posted.')
    } else {
      console.info('Skipped comment, not in production mode.')
    }
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
