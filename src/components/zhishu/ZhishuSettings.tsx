import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { ZHISHU_SOURCE_URL, ZHISHU_UPSTREAM_URL, type ZhishuStatus } from '../../shared/zhishu'
import { Button } from '../ui/Button'
import { useZhishuConnection } from './zhishu-context'

const openUrl = (url: string) => { void ipc.invoke('zhishu:open-url', url).catch(() => undefined) }

/** 网站上本应用的详情页，有新版本时去这里下载。 */
const downloadPage = (status: ZhishuStatus) => `${status.siteOrigin}/apps/${status.appKey}`

async function latestVersion(): Promise<string> {
  try {
    return await ipc.invoke('zhishu:latest-version')
  } catch {
    return ''
  }
}

/** 设置「AI 服务」：接入状态和重新接入。 */
export function ZhishuAccountSection() {
  const text = useLocaleStore(s => s.text)
  const { status, reconnect } = useZhishuConnection()
  const [pending, setPending] = useState(false)
  return (
    <div className="stage-set-rows" data-testid="zhishu-account-section">
      <div className="stage-set-row">
        <div>
          <p className="stage-set-row-title zs-account-name">{text(`已接入：${status?.userName ?? ''}`, `Connected: ${status?.userName ?? ''}`)}</p>
          <p className="stage-set-row-desc">{text(
            '写作、审稿、修稿都用你在网站上的账号调用 AI，费用从余额扣除；额度上限和停止授权在网站「我的应用」里设置。',
            'Writing, reviews and revisions call AI with your account on the website and are billed to your balance. Set usage caps or stop authorization under “My apps” on the website.',
          )}</p>
        </div>
        <div className="stage-set-row-ctl">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              try {
                await reconnect()
              } finally {
                setPending(false)
              }
            }}
          >
            {text('重新接入', 'Reconnect')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 「关于与更新」：从网站检查更新，以及开源署名。 */
export function ZhishuAbout() {
  const text = useLocaleStore(s => s.text)
  const { status } = useZhishuConnection()
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{ latest: string } | null>(null)

  const check = async () => {
    setChecking(true)
    setResult({ latest: await latestVersion() })
    setChecking(false)
  }

  const hasUpdate = !!result?.latest && result.latest !== __APP_VERSION__
  return (
    <>
      <div className="stage-set-row">
        <div>
          <p className="stage-set-row-title">{text('检查更新', 'Check for updates')}</p>
          <p className="stage-set-row-desc">{text('从网站检查本应用的新版本。', 'Check the website for a new version of this app.')}</p>
          {result && (
            <p className={`stage-set-row-desc ${hasUpdate ? 'zs-update-new' : 'zs-update-ok'}`} role="status">
              {!result.latest
                ? text('检查更新失败，请稍后再试', 'Could not check for updates. Try again later.')
                : hasUpdate
                  ? text(`有新版本 ${result.latest}`, `Version ${result.latest} is available`)
                  : text('已是最新版本', 'You are on the latest version')}
            </p>
          )}
        </div>
        <div className="stage-set-row-ctl">
          {hasUpdate && status && (
            <Button variant="secondary" size="sm" onClick={() => openUrl(downloadPage(status))}>
              <ExternalLink size={13} aria-hidden="true" />{text('去网站下载', 'Download on the website')}
            </Button>
          )}
          <Button variant="secondary" size="sm" disabled={checking} onClick={() => void check()}>
            <RefreshCw size={13} className={checking ? 'stage-update-spin' : undefined} aria-hidden="true" />
            {checking ? text('正在检查', 'Checking') : text('检查更新', 'Check for updates')}
          </Button>
        </div>
      </div>
      <div className="stage-set-row">
        <div>
          <p className="stage-set-row-title">{text('开源说明', 'Open source')}</p>
          <p className="stage-set-row-desc">{text(
            '基于「书童 Pagekin」开源项目修改，遵循 GPL-3.0 协议，修改后的源码同样公开。',
            'Modified from the open-source Pagekin project under GPL-3.0. The modified source code is public as well.',
          )}</p>
          <div className="zs-links">
            <Button variant="text" size="sm" onClick={() => openUrl(ZHISHU_SOURCE_URL)}>
              <ExternalLink size={13} aria-hidden="true" />{text('源代码', 'Source code')}
            </Button>
            <Button variant="text" size="sm" onClick={() => openUrl(ZHISHU_UPSTREAM_URL)}>
              <ExternalLink size={13} aria-hidden="true" />{text('原项目', 'Original project')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

/** 启动后到网站查一次版本，有新版在右下角提示去网站下载。 */
export function SiteUpdateNotice({ theme }: { theme: string }) {
  const text = useLocaleStore(s => s.text)
  const { status } = useZhishuConnection()
  const [latest, setLatest] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const connected = !!status?.connected

  useEffect(() => {
    if (!connected) return
    let disposed = false
    void latestVersion().then(newest => {
      if (!disposed && newest && newest !== __APP_VERSION__) setLatest(newest)
    })
    return () => { disposed = true }
  }, [connected])

  if (!status || !latest || dismissed) return null
  return (
    <div className="paper-ink zs-update-notice" data-theme={theme} role="status">
      <p>{text(`有新版本 ${latest}`, `Version ${latest} is available`)}</p>
      <div className="zs-update-notice-actions">
        <Button variant="primary" size="sm" onClick={() => openUrl(downloadPage(status))}>{text('去网站下载', 'Download on the website')}</Button>
        <Button variant="text" size="sm" onClick={() => setDismissed(true)}>{text('稍后', 'Later')}</Button>
      </div>
    </div>
  )
}
