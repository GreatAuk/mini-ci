import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { loadMiniCIConfig, loadPackageJson } from '../src/config/loadConfig'
import { createRuntimeContext } from '../src/runtime/createContext'

/** 临时目录列表，测试结束后清理 */
const tempDirs: string[] = []

/**
 * 创建临时目录。
 *
 * @returns 临时目录绝对路径
 */
async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'minici-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('loadPackageJson', () => {
  test('存在 package.json 时返回解析后的内容', async () => {
    const cwd = await createTempDir()
    await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ version: '1.0.0' }))

    await expect(loadPackageJson(cwd)).resolves.toEqual({ version: '1.0.0' })
  })

  test('不存在 package.json 时返回空对象', async () => {
    const cwd = await createTempDir()

    await expect(loadPackageJson(cwd)).resolves.toEqual({})
  })
})

describe('loadMiniCIConfig', () => {
  test('不存在配置文件时返回空对象', async () => {
    const cwd = await createTempDir()

    await expect(loadMiniCIConfig({ cwd })).resolves.toEqual({})
  })
})

describe('createRuntimeContext', () => {
  test('检查路径存在性并暴露用户主目录', async () => {
    const cwd = await createTempDir()
    const ctx = createRuntimeContext({ cwd })

    await expect(ctx.pathExists(cwd)).resolves.toBe(true)
    expect(ctx.getUserHomeDir()).toBe(os.homedir())
  })

  test('不存在的路径返回 false', async () => {
    const cwd = await createTempDir()
    const ctx = createRuntimeContext({ cwd })

    await expect(ctx.pathExists(path.join(cwd, 'nonexistent'))).resolves.toBe(false)
  })
})
