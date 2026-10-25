import { clipboard, ipcMain, shell } from 'electron'
import { ZHISHU_SOURCE_URL, ZHISHU_UPSTREAM_URL } from '../../src/shared/zhishu'
import {
  connectZhishu,
  disconnectZhishu,
  getLatestAppVersion,
  getZhishuStatus,
  loadZhishuConnection,
} from '../zhishu/zhishu-connection'

/** 只放行网站本身和署名用的两个源码地址，渲染进程不能借它打开任意链接。 */
function canOpen(url: string): boolean {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return false
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return false
  if (url === ZHISHU_SOURCE_URL || url === ZHISHU_UPSTREAM_URL) return true
  const connection = loadZhishuConnection()
  if (!connection) return false
  try {
    return new URL(connection.base_url).origin === target.origin
  } catch {
    return false
  }
}

export function registerZhishuController() {
  ipcMain.handle('zhishu:status', async (_event, verify: boolean) => getZhishuStatus(verify === true))
  ipcMain.handle('zhishu:connect', async (_event, code: string) => connectZhishu(code))
  ipcMain.handle('zhishu:disconnect', async () => disconnectZhishu())
  ipcMain.handle('zhishu:latest-version', async () => getLatestAppVersion())
  ipcMain.handle('zhishu:read-clipboard', async () => clipboard.readText())
  /** 接入成功后清掉剪贴板里的接入码；剪贴板已经换了别的内容就不动。 */
  ipcMain.handle('zhishu:clear-clipboard', async (_event, expected: string) => {
    if (clipboard.readText() === expected) clipboard.clear()
  })
  ipcMain.handle('zhishu:open-url', async (_event, url: string) => {
    if (!canOpen(url)) return { success: false }
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch {
      return { success: false }
    }
  })
}
