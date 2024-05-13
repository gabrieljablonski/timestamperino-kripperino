import qs from 'querystring'

interface ApiResponse<T> {
  data: T[]
  pagination: {
    cursor?: string
  }
}

interface TwitchVod {
  id: string
  stream_id: string
  user_id: string
  user_login: string
  user_name: string
  title: string
  description: string
  created_at: string
  published_at: string
  url: string
  thumbnail_url: string
  viewable: string
  view_count: number
  language: string
  type: string
  duration: string
  muted_segments: unknown | null
}

interface TwitchTvOptions {
  clientId: string
  clientSecret: string
}

export default class TwitchTv {
  private BASE_API_PATH = 'https://api.twitch.tv/helix'
  private OAUTH_API_PATH = 'https://id.twitch.tv/oauth2'

  private clientId: string
  private clientSecret: string
  private accessToken: string

  constructor({ clientId, clientSecret }: TwitchTvOptions) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.accessToken = ''
  }

  private async generateAccessToken() {
    const query = qs.stringify({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
    })
    const response = await fetch(`${this.OAUTH_API_PATH}/token`, {
      body: query,
      method: 'POST',
    })
    const json = await response.json()
    if (json.error) {
      throw new Error(
        `Error generating Twitch.tv access token: ${JSON.stringify(json)}`,
      )
    }
    return json.access_token
  }

  private async get<ResponseType>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<ApiResponse<ResponseType>> {
    if (!this.accessToken) {
      this.accessToken = await this.generateAccessToken()
    }
    const response = await fetch(
      `${this.BASE_API_PATH}/${path}?${qs.stringify(params)}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Client-ID': this.clientId,
        },
      },
    )
    const json = await response.json()
    if (json.error) {
      throw new Error(
        `Error fetching data from Twitch.tv: ${JSON.stringify(json)}`,
      )
    }
    return json
  }

  getVodLinkFromText(text: string): string | null {
    const match = text.match(/https:\/\/www\.twitch\.tv\/videos\/\d+/)
    return match?.[0] ?? null
  }

  getVodIdFromLink(vodLink: string): string | null {
    return (
      vodLink.match(/https:\/\/www\.twitch\.tv\/videos\/(\d+)/)?.[1] ?? null
    )
  }

  async getVodInfo(vodLink: string): Promise<TwitchVod> {
    const vodId = this.getVodIdFromLink(vodLink)
    if (!vodId) {
      throw new Error('Not a valid Twitch.tv VOD link')
    }

    const response = await this.get<TwitchVod>('videos', { id: vodId })
    const vodInfo = response.data[0]
    if (!vodInfo) {
      throw new Error(
        `Failed to fetch Twitch.tv VOD info (${JSON.stringify(response)})`,
      )
    }
    return vodInfo
  }

  async getVodInfoFromText(text: string): Promise<TwitchVod | null> {
    const vodLink = this.getVodLinkFromText(text)
    if (!vodLink) {
      return null
    }

    return this.getVodInfo(vodLink)
  }
}
