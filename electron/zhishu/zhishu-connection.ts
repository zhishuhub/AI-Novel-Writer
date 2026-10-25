import fs from 'node:fs'
import path from 'node:path'
import { app, net } from 'electron'
import type { ModelProfile } from '../../src/shared/ipc-channels'
import {
  ZHISHU_APP_KEY,
  ZHISHU_CHAT_MODEL,
  ZHISHU_CODE_PATTERN,
  ZHISHU_MODEL_ID,
  type ZhishuStatus,
} from '../../src/shared/zhishu'
import { writeJsonFile } from '../utils/config-utils'
import { mainText } from '../i18n'

/**
 * 一键接入：用户在网站「我的应用」点「一键接入」拿到接入码，应用把接入码和应用编号发给接入接口，
 * 换回 base_url、api_key。接入信息存在 userData 下的 zhishu-connection.json（不参与全局数据迁移），
 * 接入后模型列表只有一条由它生成的配置，用户不能在设置里改地址和密钥。
 */

// 接入地址固定，不提供修改入口；ZHISHU_CONNECT_URL 只给本地测试用
const CONNECT_URL = process.env.ZHISHU_CONNECT_URL?.trim() || 'https://zhishuhub.com/api/apps/connect'
const CONNECTION_FILE_NAME = 'zhishu-connection.json'
// 中转站背后的模型各不相同，输出上限取一个各家都接受的值，够写一章
const CHAT_MAX_TOKENS = 16_384

/** 应用自己的提示按界面语言给；网站返回的提示本身是写给用户看的，原样透传。 */
const say = (zh: string, en: string) => mainText(app.getLocale(), zh, en)

interface ZhishuConnection {
  base_url: string
  api_key: string
  user_name: string
  models: string[]
  connected_at: string
}

function connectionPath(): string {
  return path.join(app.getPath('userData'), CONNECTION_FILE_NAME)
}

export function loadZhishuConnection(): ZhishuConnection | null {
  try {
    const data = JSON.parse(fs.readFileSync(connectionPath(), 'utf-8')) as Partial<ZhishuConnection>
    if (!data.base_url || !data.api_key) return null
    return data as ZhishuConnection
  } catch {
    return null
  }
}

function clearZhishuConnection(): void {
  try {
    fs.unlinkSync(connectionPath())
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

/** 接入后唯一的模型配置；没接入时为空，界面只显示接入页。 */
export function zhishuModelProfiles(): ModelProfile[] {
  const connection = loadZhishuConnection()
  if (!connection) return []
  return [{
    id: ZHISHU_MODEL_ID,
    name: 'AI',
    provider: 'custom',
    protocol: 'openai',
    modelName: ZHISHU_CHAT_MODEL,
    apiKey: connection.api_key,
    baseUrl: connection.base_url,
    temperature: 0.7,
    maxTokens: CHAT_MAX_TOKENS,
    purposes: ['generation', 'refinement', 'summary'],
  }]
}

export function zhishuDefaultModelId(): string | null {
  return loadZhishuConnection() ? ZHISHU_MODEL_ID : null
}

function siteOrigin(connection: ZhishuConnection | null): string {
  const match = /^(https?:\/\/[^/]+)/.exec(connection?.base_url || CONNECT_URL)
  return match ? match[1] : 'https://zhishuhub.com'
}

function status(connection: ZhishuConnection | null, message = ''): ZhishuStatus {
  return {
    connected: connection !== null,
    userName: connection?.user_name ?? '',
    siteOrigin: siteOrigin(connection),
    appKey: ZHISHU_APP_KEY,
    message,
  }
}

/** 用保存的密钥拉一次模型列表：401（额度上限用完除外）说明接入已在网站停止授权。 */
async function tokenRevoked(connection: ZhishuConnection): Promise<boolean> {
  let response: Response
  try {
    response = await net.fetch(`${connection.base_url.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${connection.api_key}` },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return false
  }
  if (response.status !== 401) return false
  const body = await response.json().catch(() => null) as { error?: { code?: string } } | null
  return body?.error?.code !== 'app_quota_exhausted'
}

/** 接入状态；verify 为真时顺带确认接入还有效，失效就清掉。 */
export async function getZhishuStatus(verify: boolean): Promise<ZhishuStatus> {
  const connection = loadZhishuConnection()
  if (connection && verify && await tokenRevoked(connection)) {
    clearZhishuConnection()
    return status(null, say('接入已失效，请回到网站重新点「一键接入」', 'The connection is no longer valid. Click "Connect in one click" on the website again.'))
  }
  return status(connection)
}

/** 用接入码换调用地址和密钥。失败时把网站返回的提示原样给用户看。 */
export async function connectZhishu(rawCode: string): Promise<ZhishuStatus> {
  const match = ZHISHU_CODE_PATTERN.exec(String(rawCode ?? '').toUpperCase())
  if (!match) return status(loadZhishuConnection(), say('没有识别到接入码，请回到网站重新点「一键接入」', 'No connect code found. Click "Connect in one click" on the website again.'))
  let response: Response
  try {
    response = await net.fetch(CONNECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: ZHISHU_APP_KEY, code: match[0] }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    return status(loadZhishuConnection(), say('网络异常，请检查网络后重试', 'Network error. Check your connection and try again.'))
  }
  if (response.status === 429) return status(loadZhishuConnection(), say('操作太频繁，请过几秒再试', 'Too many attempts. Wait a few seconds and try again.'))
  const result = await response.json().catch(() => ({})) as {
    success?: boolean
    message?: string
    data?: Partial<ZhishuConnection>
  }
  if (!result.success || !result.data?.base_url || !result.data.api_key) {
    return status(loadZhishuConnection(), result.message || say('接入失败，请稍后再试', 'Could not connect. Try again later.'))
  }
  const connection: ZhishuConnection = {
    base_url: result.data.base_url,
    api_key: result.data.api_key,
    user_name: result.data.user_name ?? '',
    models: result.data.models ?? [],
    connected_at: new Date().toISOString(),
  }
  writeJsonFile(connectionPath(), connection)
  return status(connection)
}

/** 重新接入：清掉保存的接入信息，回到接入页。 */
export function disconnectZhishu(): ZhishuStatus {
  clearZhishuConnection()
  return status(null)
}

/** 网站上本应用的最新版本号（公开接口），取不到返回空。子站用户查自己所在的网站，不引到主站。 */
export async function getLatestAppVersion(): Promise<string> {
  const connection = loadZhishuConnection()
  if (!connection) return ''
  try {
    const response = await net.fetch(`${siteOrigin(connection)}/api/apps/${ZHISHU_APP_KEY}`, {
      signal: AbortSignal.timeout(10_000),
    })
    const result = await response.json() as { success?: boolean; data?: { version?: string } }
    return result.success ? String(result.data?.version ?? '') : ''
  } catch {
    return ''
  }
}
