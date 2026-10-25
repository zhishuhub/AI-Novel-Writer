import { vi } from 'vitest'

/**
 * 原项目的测试验证「用户自己配置模型、检索模型、更新」的原行为，默认按关闭一键接入来跑；
 * 一键接入的行为由 electron/zhishu/__tests__ 里的测试单独覆盖（那里取消这个 mock）。
 */
vi.mock('../src/shared/zhishu', async importOriginal => ({
  ...await importOriginal<typeof import('../src/shared/zhishu')>(),
  ZHISHU_MANAGED_AI: false,
}))
