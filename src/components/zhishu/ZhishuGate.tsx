import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { ZHISHU_CODE_PATTERN, type ZhishuStatus } from '../../shared/zhishu'
import { Button } from '../ui/Button'
import { ZhishuContext } from './zhishu-context'

const VERIFY_INTERVAL_MS = 60_000

async function readClipboard(): Promise<string> {
  try {
    return await ipc.invoke('zhishu:read-clipboard')
  } catch {
    return ''
  }
}

/**
 * 接入前只显示接入页；接入后切回窗口时（最多一分钟一次）确认接入还有效。
 * 在网站停止授权后，接入页盖在工作台上面，不卸载编辑器，没保存的稿子还在，重新接入后接着写。
 */
export function ZhishuGate({ theme, children }: { theme: string; children: ReactNode }) {
  const text = useLocaleStore(s => s.text)
  const [status, setStatus] = useState<ZhishuStatus | null>(null)
  const [everConnected, setEverConnected] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [code, setCode] = useState('')
  const [tip, setTip] = useState('')
  const [connecting, setConnecting] = useState(false)
  const connectingRef = useRef(false)
  const lastVerifyRef = useRef(0)

  const apply = useCallback((next: ZhishuStatus) => {
    setStatus(next)
    // i18n-exempt: 主进程已按界面语言写好，网站返回的提示本身是写给用户看的中文
    setTip(next.message)
    if (next.connected) setEverConnected(true)
  }, [])

  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let disposed = false
    ipc.invoke('zhishu:status', true).then(next => {
      if (disposed) return
      lastVerifyRef.current = Date.now()
      apply(next)
    }).catch(() => { if (!disposed) setLoadError(true) })
    return () => { disposed = true }
  }, [apply, attempt])

  const tryConnect = useCallback(async (raw: string, fromClipboard: boolean) => {
    const match = raw.toUpperCase().match(ZHISHU_CODE_PATTERN)
    if (!match || connectingRef.current) return
    connectingRef.current = true
    setConnecting(true)
    setTip(text('正在接入…', 'Connecting…'))
    try {
      const next = await ipc.invoke('zhishu:connect', match[0])
      apply(next)
      if (next.connected) {
        setCode('')
        if (fromClipboard) await ipc.invoke('zhishu:clear-clipboard', raw).catch(() => undefined)
      }
    } catch {
      setTip(text('接入没有完成，请重启应用后再试', 'Could not finish connecting. Restart the app and try again.'))
    } finally {
      connectingRef.current = false
      setConnecting(false)
    }
  }, [apply, text])

  // 没接入时：打开和切回窗口都读一次剪贴板；接入后：切回窗口时确认接入还有效
  useEffect(() => {
    if (!status) return
    const onFocus = async () => {
      if (!status.connected) {
        const clip = await readClipboard()
        if (ZHISHU_CODE_PATTERN.test(clip.toUpperCase())) void tryConnect(clip, true)
        return
      }
      if (Date.now() - lastVerifyRef.current < VERIFY_INTERVAL_MS) return
      lastVerifyRef.current = Date.now()
      try {
        const next = await ipc.invoke('zhishu:status', true)
        if (!next.connected) apply(next)
      } catch {
        // 主进程暂时没响应时不打扰用户，下次切回窗口再查
      }
    }
    if (!status.connected) void onFocus()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [status, tryConnect, apply])

  const reconnect = useCallback(async () => {
    apply(await ipc.invoke('zhishu:disconnect'))
  }, [apply])

  const pasteFromClipboard = async () => {
    const clip = await readClipboard()
    setCode(clip.trim())
    if (!ZHISHU_CODE_PATTERN.test(clip.toUpperCase())) {
      setTip(text('剪贴板里没有接入码，请回到网站重新点「一键接入」', 'No connect code on the clipboard. Click “Connect in one click” on the website again.'))
      return
    }
    void tryConnect(clip, true)
  }

  if (loadError) {
    return (
      <main className="paper-ink zs-gate" data-theme={theme}>
        <section className="zs-gate-card" role="alert">
          <p className="zs-gate-lead">{text('读取接入信息失败，请重试', 'Could not read the connection. Try again.')}</p>
          <Button variant="primary" onClick={() => { setLoadError(false); setAttempt(n => n + 1) }}>{text('重试', 'Retry')}</Button>
        </section>
      </main>
    )
  }
  if (!status) return null

  const tipIsError = !!tip && !connecting
  const connectPage = (
    <main className={`paper-ink zs-gate${everConnected ? ' zs-gate--overlay' : ''}`} data-theme={theme}>
      <section className="zs-gate-card" aria-labelledby="zs-gate-title">
        <span className="stage-set-about-mark zs-gate-mark" aria-hidden="true" />
        <h1 id="zs-gate-title" className="zs-gate-title">{text('先接入 AI', 'Connect AI first')}</h1>
        <p className="zs-gate-lead">{text(
          '接入后用你在网站上的账号写作，费用从余额扣除。',
          'Once connected, writing uses your account on the website and is billed to your balance.',
        )}</p>
        <ol className="zs-gate-steps">
          <li>{text(
            '回到网站，在「我的应用」里找到本应用，点「一键接入」，接入码会自动复制。',
            'On the website, open “My apps”, find this app and click “Connect in one click”. The connect code is copied automatically.',
          )}</li>
          <li>{text(
            '回到这里，接入码会被自动识别；没反应就粘贴到下面的输入框。',
            'Come back here and the code is detected automatically. If nothing happens, paste it below.',
          )}</li>
        </ol>
        <div className="zs-gate-input">
          <input
            className="pi-input"
            value={code}
            onChange={event => {
              setCode(event.target.value)
              void tryConnect(event.target.value, false)
            }}
            placeholder="APP-XXXX-XXXX-XXXX"
            aria-label={text('接入码', 'Connect code')}
            spellCheck={false}
            autoFocus
          />
          <Button variant="secondary" disabled={connecting} onClick={() => void pasteFromClipboard()}>
            {text('粘贴', 'Paste')}
          </Button>
        </div>
        <p className={`zs-gate-tip${tipIsError ? ' zs-gate-tip--error' : ''}`} role="status" aria-live="polite">{tip}</p>
      </section>
    </main>
  )

  if (!everConnected) return connectPage
  return (
    <ZhishuContext.Provider value={{ status, reconnect }}>
      {children}
      {!status.connected && connectPage}
    </ZhishuContext.Provider>
  )
}
