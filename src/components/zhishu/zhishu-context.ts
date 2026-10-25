import { createContext, useContext } from 'react'
import type { ZhishuStatus } from '../../shared/zhishu'

export type ZhishuContextValue = {
  status: ZhishuStatus | null
  /** 清掉当前接入，回到接入页 */
  reconnect: () => Promise<void>
}

export const ZhishuContext = createContext<ZhishuContextValue>({ status: null, reconnect: async () => {} })

/** 取接入状态（用户名、网站地址），设置页和更新提示用。 */
export const useZhishuConnection = () => useContext(ZhishuContext)
