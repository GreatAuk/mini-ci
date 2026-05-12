import path from 'node:path'
import { describe, expect, expectTypeOf, test } from 'vitest'
import { normalizeConfig } from '../src/config/normalize'
import { validateConfig, validatePlatformConfig } from '../src/config/schema'

describe('config schema', () => {
  test('微信平台缺少 privateKeyPath 时抛出包含字段路径的错误', () => {
    expect(() =>
      validatePlatformConfig('mp-weixin', {
        'mp-weixin': {
          appid: 'wx-appid',
        },
      }),
    ).toThrow(/mp-weixin\.privateKeyPath/)
  })

  test('支付宝平台缺少 privateKeyPath 或 privateKey 时抛出包含字段路径的错误', () => {
    expect(() =>
      validatePlatformConfig('mp-alipay', {
        'mp-alipay': {
          appid: 'ali-appid',
          toolId: 'tool-id',
        },
      }),
    ).toThrow(/mp-alipay\.privateKeyPath/)
  })

  test('缺少当前平台配置时抛出明确错误', () => {
    expect(() => validatePlatformConfig('mp-jd', {})).toThrow(
      'mp-jd 平台配置不能为空',
    )
  })

  test('空字符串配置会被拒绝', () => {
    expect(() =>
      validatePlatformConfig('mp-baidu', {
        'mp-baidu': {
          token: '',
        },
      }),
    ).toThrow(/mp-baidu\.token/)
  })

  test('支付宝 deleteVersion 非法格式会被拒绝', () => {
    expect(() =>
      validatePlatformConfig('mp-alipay', {
        'mp-alipay': {
          appid: 'ali-appid',
          toolId: 'tool-id',
          privateKey: 'private-key',
          deleteVersion: 'foo',
        },
      }),
    ).toThrow(/mp-alipay\.deleteVersion/)
  })

  test('未知字段会被拒绝', () => {
    expect(() =>
      validateConfig({
        'mp-wechat': {
          appid: 'wx-appid',
        },
      }),
    ).toThrow(/mp-wechat/)
  })

  test('非法 desc 类型会被拒绝', () => {
    expect(() =>
      validateConfig({
        desc: 123,
      }),
    ).toThrow(/desc/)
  })
})

describe('normalizeConfig', () => {
  test('命令行 version、desc、projectPath 优先于配置和 packageJson，并解析相对 projectPath', async () => {
    /** 当前工作目录 */
    const cwd = '/workspace/project'

    await expect(
      normalizeConfig({
        cwd,
        args: {
          operation: 'upload',
          platform: 'mp-weixin',
          version: '2.0.0',
          desc: '命令行描述',
          projectPath: 'dist/custom',
        },
        config: {
          version: '1.0.0',
          desc: '配置描述',
          projectPath: 'dist/config',
          'mp-weixin': {
            appid: 'wx-appid',
            privateKeyPath: 'keys/private.key',
          },
        },
        packageJson: {
          version: '0.1.0',
          description: '包描述',
        },
      }),
    ).resolves.toMatchObject({
      version: '2.0.0',
      desc: '命令行描述',
      projectPath: path.join(cwd, 'dist/custom'),
    })
  })

  test('支持异步 desc 函数，并在上下文归一化后执行', async () => {
    /** 当前工作目录 */
    const cwd = '/workspace/project'

    /** 归一化后的配置 */
    const normalized = await normalizeConfig({
      cwd,
      args: {
        operation: 'preview',
        platform: 'mp-weixin',
        version: '2.0.0',
        projectPath: 'dist/custom',
      },
      config: {
        desc: async ({
          operation,
          platform,
          version,
          projectPath,
          cwd: contextCwd,
          packageJson,
        }) => {
          expectTypeOf(packageJson).toEqualTypeOf<Record<string, unknown>>()
          return `${operation}|${platform}|${version}|${projectPath}|${contextCwd}|${packageJson.name}`
        },
        'mp-weixin': {
          appid: 'wx-appid',
          privateKeyPath: 'keys/private.key',
        },
      },
      packageJson: {
        name: 'demo-mini',
      },
    })

    expect(normalized.desc).toBe(
      `preview|mp-weixin|2.0.0|${path.join(cwd, 'dist/custom')}|${cwd}|demo-mini`,
    )
  })

  test('回退到 packageJson.version 和 packageJson.description', async () => {
    await expect(
      normalizeConfig({
        cwd: '/workspace/project',
        args: {
          operation: 'upload',
          platform: 'mp-weixin',
        },
        config: {
          'mp-weixin': {
            appid: 'wx-appid',
            privateKeyPath: 'keys/private.key',
          },
        },
        packageJson: {
          version: '3.1.4',
          description: '包描述',
        },
      }),
    ).resolves.toMatchObject({
      version: '3.1.4',
      desc: '包描述',
    })
  })

  test('支持同步 desc 函数', async () => {
    await expect(
      normalizeConfig({
        cwd: '/workspace/project',
        args: {
          operation: 'upload',
          platform: 'mp-weixin',
        },
        config: {
          version: '1.0.0',
          desc: ({ platform, version }) => `${platform}-${version}`,
          'mp-weixin': {
            appid: 'wx-appid',
            privateKeyPath: 'keys/private.key',
          },
        },
        packageJson: {},
      }),
    ).resolves.toMatchObject({
      desc: 'mp-weixin-1.0.0',
    })
  })

  test('命令行 desc 覆盖配置中的函数 desc', async () => {
    await expect(
      normalizeConfig({
        cwd: '/workspace/project',
        args: {
          operation: 'upload',
          platform: 'mp-weixin',
          desc: '命令行描述',
        },
        config: {
          desc: () => '配置函数描述',
          'mp-weixin': {
            appid: 'wx-appid',
            privateKeyPath: 'keys/private.key',
          },
        },
        packageJson: {},
      }),
    ).resolves.toMatchObject({
      desc: '命令行描述',
    })
  })

  test('缺少 desc 来源时自动生成默认描述', async () => {
    /** 归一化后的配置 */
    const normalized = await normalizeConfig({
      cwd: '/workspace/project',
      args: {
        operation: 'upload',
        platform: 'mp-weixin',
      },
      config: {
        'mp-weixin': {
          appid: 'wx-appid',
          privateKeyPath: 'keys/private.key',
        },
      },
      packageJson: {},
    })

    expect(normalized.desc).toMatch(/^CI 自动构建于 /)
  })

  test('desc 函数返回非字符串时抛出明确错误', async () => {
    await expect(
      normalizeConfig({
        cwd: '/workspace/project',
        args: {
          operation: 'upload',
          platform: 'mp-weixin',
        },
        config: {
          desc: (() => undefined) as never,
          'mp-weixin': {
            appid: 'wx-appid',
            privateKeyPath: 'keys/private.key',
          },
        },
        packageJson: {},
      }),
    ).rejects.toThrow(/desc/)
  })
})
