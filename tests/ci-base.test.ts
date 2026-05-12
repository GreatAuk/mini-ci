import { describe, expect, test } from 'vitest'
import { BaseCI } from '../src/ci/BaseCI'

import type { NormalizedMiniCIConfig } from '../src/types'

/** 用于测试的假 CI 类 */
class FakeCI extends BaseCI<'mp-weixin'> {
  init(): void {}

  async open() {
    return this.createResult(true)
  }

  async preview() {
    return this.createResult(true, {
      qrCodeContent: 'preview-content',
      qrCodeLocalPath: '/repo/preview.png',
    })
  }

  async upload() {
    return this.createResult(true, {
      qrCodeContent: 'upload-content',
      qrCodeLocalPath: '/repo/upload.png',
    })
  }
}

/**
 * 创建测试用的微信归一化配置。
 *
 * @returns 微信平台归一化配置
 */
function createConfig(): NormalizedMiniCIConfig<'mp-weixin'> {
  return {
    operation: 'upload',
    platform: 'mp-weixin',
    cwd: '/repo',
    projectPath: '/repo/dist/build/mp-weixin',
    version: '1.0.0',
    desc: '测试描述',
    packageJson: {},
    platformConfig: {
      appid: 'wx-appid',
      privateKeyPath: 'key/private.key',
    },
  }
}

describe('BaseCI', () => {
  test('createResult 包含共享元数据', async () => {
    const ci = new FakeCI(createConfig())
    const result = await ci.upload()

    expect(result).toMatchObject({
      success: true,
      operation: 'upload',
      platform: 'mp-weixin',
      version: '1.0.0',
      desc: '测试描述',
      projectPath: '/repo/dist/build/mp-weixin',
      qrCodeContent: 'upload-content',
      qrCodeLocalPath: '/repo/upload.png',
    })
  })

  test('preview 结果包含二维码信息', async () => {
    const ci = new FakeCI(createConfig())
    const result = await ci.preview()

    expect(result.qrCodeContent).toBe('preview-content')
    expect(result.qrCodeLocalPath).toBe('/repo/preview.png')
  })

  test('open 结果不包含二维码信息', async () => {
    const ci = new FakeCI(createConfig())
    const result = await ci.open()

    expect(result.success).toBe(true)
    expect(result.qrCodeContent).toBeUndefined()
  })
})
