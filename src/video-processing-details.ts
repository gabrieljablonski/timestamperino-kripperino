import fs from 'fs'

interface VodInfo {
  link: string
  publishedAt: string
}

interface VideoDetails {
  id: string
  title: string
  description: string
  publishedAt: string
  vodInfo: VodInfo | null
}

interface VideoProcessingDetailsOptions {
  filepath: string
}

export default class VideoProcessingDetails {
  private filepath: string
  private videos: Record<string, VideoDetails> = {}

  constructor({ filepath }: VideoProcessingDetailsOptions) {
    this.filepath = filepath
    this.load()
  }

  private load() {
    try {
      this.videos = JSON.parse(fs.readFileSync(this.filepath).toString())
    } catch (error) {
      throw new Error(
        `Error loading video processing details ${JSON.stringify(error)}`,
      )
    }
  }

  private save() {
    fs.writeFileSync(this.filepath, JSON.stringify(this.videos, null, 2))
  }

  processed(videoId: string) {
    return this.videos[videoId] !== undefined
  }

  update(videoId: string, details: VideoDetails) {
    this.videos[videoId] = details
    this.save()
  }
}
