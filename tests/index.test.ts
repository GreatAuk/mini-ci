import { describe, expect, expectTypeOf, test } from 'vitest'
import {
  defineConfig,
  supportedOperations,
  supportedPlatforms,
} from '../src/index'

import type {
  NormalizedMiniCIConfig,
  PlatformConfigMap,
} from '../src/index'

describe('public api', () => {
  test('defineConfig returns the same config object', () => {
    const config = defineConfig({
      version: '1.0.0',
      desc: '发布描述',
      'mp-weixin': {
        appid: 'wx-appid',
        privateKeyPath: 'key/private.key',
      },
    })

    expect(config.version).toBe('1.0.0')
    expect(config.desc).toBe('发布描述')
  })

  test('exports supported uniapp platforms', () => {
    expect(supportedPlatforms).toEqual([
      'mp-weixin',
      'mp-alipay',
      'mp-baidu',
      'mp-jd',
      'mp-toutiao',
    ])
  })

  test('exports supported cli operations', () => {
    expect(supportedOperations).toEqual(['open', 'preview', 'upload'])
  })

  test('defineConfig keeps desc function context and config shape types', () => {
    const config = defineConfig({
      version: '1.0.0',
      desc: ({ platform, version, projectPath }) => {
        expectTypeOf(platform).toEqualTypeOf<
          'mp-weixin' | 'mp-alipay' | 'mp-baidu' | 'mp-jd' | 'mp-toutiao'
        >()
        expectTypeOf(version).toEqualTypeOf<string>()
        expectTypeOf(projectPath).toEqualTypeOf<string>()

        return `${platform}-${version}`
      },
      'mp-weixin': {
        appid: 'wx-appid',
        privateKeyPath: 'key/private.key',
      },
    })

    expectTypeOf(config['mp-weixin'].appid).toEqualTypeOf<'wx-appid'>()
  })

  test('normalized config narrows platformConfig by platform', () => {
    type WeixinConfig = NormalizedMiniCIConfig<'mp-weixin'>

    expectTypeOf<WeixinConfig['platform']>().toEqualTypeOf<'mp-weixin'>()
    expectTypeOf<WeixinConfig['platformConfig']>().toEqualTypeOf<
      PlatformConfigMap['mp-weixin']
    >()
  })
})
