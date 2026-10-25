import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('../../../src/shared/zhishu')

const userData = { dir: '' }
const fetchMock = vi.fn()

vi.mock('electron', () => ({
  app: { getPath: () => userData.dir, getLocale: () => 'zh-CN' },
  net: { fetch: (...args: unknown[]) => fetchMock(...args) },
}))

vi.mock('../../i18n', () => ({ mainText: (_locale: string, zh: string) => zh }))

const {
  connectZhishu,
  disconnectZhishu,
  getLatestAppVersion,
  getZhishuStatus,
  zhishuDefaultModelId,
  zhishuModelProfiles,
} = await import('../zhishu-connection')

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const connectOk = () => json(200, {
  success: true,
  data: { base_url: 'https://site.example/v1', api_key: 'sk-test', models: ['chat'], user_name: '张**' },
})

describe('一键接入', () => {
  beforeEach(() => {
    userData.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhishu-connection-'))
    fetchMock.mockReset()
  })
  afterEach(() => {
    fs.rmSync(userData.dir, { recursive: true, force: true })
  })

  it('没接入时没有模型，接入码换到地址后只有一条 chat 配置', async () => {
    expect(zhishuModelProfiles()).toEqual([])
    expect(zhishuDefaultModelId()).toBeNull()
    fetchMock.mockResolvedValueOnce(connectOk())

    const status = await connectZhishu('接入码：app-22t4-zlsb-hjjz')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://zhishuhub.com/api/apps/connect')
    expect(JSON.parse(init.body)).toEqual({ app_id: 'pagekn26', code: 'APP-22T4-ZLSB-HJJZ' })
    expect(status).toMatchObject({ connected: true, userName: '张**', siteOrigin: 'https://site.example', appKey: 'pagekn26', message: '' })
    const [model] = zhishuModelProfiles()
    expect(model).toMatchObject({ id: 'zhishu-chat', protocol: 'openai', modelName: 'chat', baseUrl: 'https://site.example/v1', apiKey: 'sk-test' })
    expect(model.purposes).not.toContain('embedding')
    expect(zhishuDefaultModelId()).toBe('zhishu-chat')
  })

  it('认不出接入码时不联网', async () => {
    const status = await connectZhishu('hello')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(status.connected).toBe(false)
    expect(status.message).toContain('没有识别到接入码')
  })

  it('网站拒绝时把网站的提示原样给用户', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: false, code: 'code_expired', message: '接入码已过期，请回到网站重新点「一键接入」' }))
    const status = await connectZhishu('APP-22T4-ZLSB-HJJZ')
    expect(status).toMatchObject({ connected: false, message: '接入码已过期，请回到网站重新点「一键接入」' })
  })

  it('在网站停止授权后清掉接入，额度上限用完时保留', async () => {
    fetchMock.mockResolvedValueOnce(connectOk())
    await connectZhishu('APP-22T4-ZLSB-HJJZ')

    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'app_quota_exhausted', message: '额度上限已用完' } }))
    expect((await getZhishuStatus(true)).connected).toBe(true)

    fetchMock.mockResolvedValueOnce(json(401, { error: { code: 'invalid_token', message: '无效的令牌' } }))
    const revoked = await getZhishuStatus(true)
    expect(revoked.connected).toBe(false)
    expect(revoked.message).toContain('接入已失效')
    expect(zhishuModelProfiles()).toEqual([])
  })

  it('网络不通时不当作停止授权', async () => {
    fetchMock.mockResolvedValueOnce(connectOk())
    await connectZhishu('APP-22T4-ZLSB-HJJZ')
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    expect((await getZhishuStatus(true)).connected).toBe(true)
  })

  it('查用户所在网站的最新版本，重新接入后回到未接入', async () => {
    fetchMock.mockResolvedValueOnce(connectOk())
    await connectZhishu('APP-22T4-ZLSB-HJJZ')
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: { version: '1.3.2-zs.2' } }))

    expect(await getLatestAppVersion()).toBe('1.3.2-zs.2')
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe('https://site.example/api/apps/pagekn26')

    expect(disconnectZhishu().connected).toBe(false)
    expect(zhishuModelProfiles()).toEqual([])
  })
})
