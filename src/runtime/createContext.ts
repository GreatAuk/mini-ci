import { existsSync } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import os from 'node:os'
import { createLogger } from './logger'

import type { Logger } from './logger'

/** 运行时上下文接口 */
export interface RuntimeContext {
  /** 当前工作目录 */
  cwd: string
  /** 日志实例 */
  logger: Logger
  /** 判断路径是否存在 */
  pathExists(path: string): Promise<boolean>
  /** 同步判断路径是否存在 */
  pathExistsSync(path: string): boolean
  /** 读取文本文件 */
  readTextFile(path: string): Promise<string>
  /** 读取用户主目录 */
  getUserHomeDir(): string
}

/** 创建运行时上下文的选项 */
interface CreateRuntimeContextOptions {
  /** 当前工作目录 */
  cwd: string
  /** 自定义日志实例 */
  logger?: Logger
}

/**
 * 创建运行时上下文实例。
 *
 * @param options 创建选项
 * @returns 运行时上下文
 */
export function createRuntimeContext(options: CreateRuntimeContextOptions): RuntimeContext {
  return {
    cwd: options.cwd,
    logger: options.logger || createLogger(),
    async pathExists(filePath) {
      try {
        await access(filePath)
        return true
      } catch {
        return false
      }
    },
    pathExistsSync(filePath) {
      return existsSync(filePath)
    },
    readTextFile(filePath) {
      return readFile(filePath, 'utf8')
    },
    getUserHomeDir() {
      return os.homedir()
    },
  }
}
