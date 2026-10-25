/**
 * 一键接入：AI 服务只用网站发的接入码换来的地址和密钥，用户不能自己配置服务商、地址、密钥和模型。
 * 原项目的模型配置代码保留不删，用 ZHISHU_MANAGED_AI 开关切走，方便以后合并上游。
 */
export const ZHISHU_MANAGED_AI = true

/** 网站上本应用的编号，接入和检查更新都用它。 */
export const ZHISHU_APP_KEY = 'pagekn26'

/** 接入后唯一的模型配置。对话写 chat，由平台换成当前模型，模型更新时应用不用改。 */
export const ZHISHU_MODEL_ID = 'zhishu-chat'
export const ZHISHU_CHAT_MODEL = 'chat'

export const ZHISHU_CODE_PATTERN = /APP-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/

/** 修改后的源码与原项目，「关于」页的署名链接。 */
export const ZHISHU_SOURCE_URL = 'https://github.com/zhishuhub/AI-Novel-Writer'
export const ZHISHU_UPSTREAM_URL = 'https://github.com/EthanYoQ/AI-Novel-Writer'

export interface ZhishuStatus {
  connected: boolean
  userName: string
  /** 用户所在网站的地址，检查更新、去网站下载都用它 */
  siteOrigin: string
  appKey: string
  /** 接入失败或接入失效时给用户看的提示 */
  message: string
}
