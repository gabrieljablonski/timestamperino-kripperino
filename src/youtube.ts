import qs from 'querystring'
import ytdlp from 'youtube-dl-exec'

interface ApiResponse<T> {
  kind: string
  etag: string
  nextPageToken?: string
  prevPageToken?: string
  pageInfo: {
    totalResults: number
    resultsPerPage: number
  }
  items: T[]
}

interface Thumbnail {
  url: string
  width: number
  height: number
}

interface Thumbnails {
  default: Thumbnail
  medium: Thumbnail
  high: Thumbnail
  standard: Thumbnail
  maxres: Thumbnail
}

interface PlaylistItem {
  kind: 'youtube#playlistItem'
  etag: string
  id: string
  snippet: {
    publishedAt: string
    channelId: string
    title: string
    description: string
    thumbnails: Thumbnails
    channelTitle: string
    playlistId: string
    position: number
    resourceId: {
      kind: string
      videoId: string
    }
    videoOwnerChannelTitle: string
    videoOwnerChannelId: string
  }
}

interface CommentThread {
  snippet: {
    channelId: string
    videoId: string
    topLevelComment: {
      snippet: {
        textOriginal: string
      }
    }
  }
}

interface RequestArgs {
  path: 'playlistItems' | 'commentThreads'
  params?: Record<string, string | number>
  body?: unknown
  method: 'GET' | 'POST'
  authorization?: string
}

interface DownloadVideoOptions {
  from?: number
  to?: number
  format?: string
}

interface YouTubeOptions {
  apiKey: string
  clientId: string
  clientSecret: string
  commenterRefreshToken: string
}

export default class YouTube {
  private BASE_API_PATH = 'https://youtube.googleapis.com/youtube/v3'
  private OAUTH_API_PATH = 'https://oauth2.googleapis.com/token'

  private apiKey: string
  private clientId: string
  private clientSecret: string
  private commenterRefreshToken: string
  private commenterAccessToken: string

  constructor({
    apiKey,
    clientId,
    clientSecret,
    commenterRefreshToken,
  }: YouTubeOptions) {
    this.apiKey = apiKey
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.commenterRefreshToken = commenterRefreshToken
    this.commenterAccessToken = ''
  }

  private async getCommenterAccessToken(): Promise<string> {
    const params = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.commenterRefreshToken,
      grant_type: 'refresh_token',
    }
    const response = await fetch(this.OAUTH_API_PATH, {
      method: 'POST',
      body: qs.stringify(params),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const json = await response.json()
    if (json.error || !json.access_token) {
      throw new Error(`Failed to refresh access token: ${JSON.stringify(json)}`)
    }
    return json.access_token
  }

  private async request<T>(args: RequestArgs): Promise<ApiResponse<T>> {
    const params = {
      ...args.params,
      key: this.apiKey,
    }
    const path = `${this.BASE_API_PATH}/${args.path}?${qs.stringify(params)}`
    const body = args.body ? JSON.stringify(args.body) : undefined
    const result = await fetch(path, {
      method: args.method,
      body,
      headers: args.authorization
        ? { Authorization: args.authorization }
        : undefined,
    })
    const json = await result.json()
    if (json.error) {
      throw new Error(`YouTube API error: ${JSON.stringify(json)}`)
    }
    return json
  }

  async getLastUpload(playlistId: string): Promise<PlaylistItem> {
    const response = await this.request<PlaylistItem>({
      path: 'playlistItems',
      params: {
        part: 'snippet',
        playlistId,
        maxResults: 1,
      },
      method: 'GET',
    })
    const lastUpload = response.items[0]
    if (!lastUpload) {
      throw new Error('Failed to fetch last upload')
    }
    return lastUpload
  }

  async addComment(channelId: string, videoId: string, text: string) {
    if (!this.commenterAccessToken) {
      this.commenterAccessToken = await this.getCommenterAccessToken()
    }
    const comment: CommentThread = {
      snippet: {
        channelId,
        videoId,
        topLevelComment: {
          snippet: {
            textOriginal: text,
          },
        },
      },
    }
    this.request({
      path: 'commentThreads',
      params: { part: 'snippet' },
      body: comment,
      authorization: `Bearer ${this.commenterAccessToken}`,
      method: 'POST',
    })
  }

  async downloadVideo(
    videoId: string,
    { from = 0, to = -1, format = '247' }: DownloadVideoOptions,
  ) {
    return ytdlp(`https://www.youtube.com/watch?v=${videoId}`, {
      format,
      downloadSections: `*${from}-${to ? to : 'inf'}`,
      output: '%(id)s.%(ext)s',
    })
  }
}
