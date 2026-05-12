import path from 'node:path'
import { validateConfig, validatePlatformConfig } from './schema'

import type {
  MiniCIConfig,
  MiniCIDescContext,
  MiniCIPlatform,
  NormalizedMiniCIConfig,
  ParsedCliArgs,
} from '../types'

/** 配置归一化入参 */
export interface NormalizeConfigInput<P extends MiniCIPlatform = MiniCIPlatform> {
  /** 已解析的命令行参数 */
  args: ParsedCliArgs & { platform: P }
  /** 当前工作目录 */
  cwd: string
  /** 已加载的 minici 配置 */
  config: MiniCIConfig
  /** 当前项目 package.json 内容 */
  packageJson: Record<string, unknown>
}

/**
 * 读取 package.json 中的字符串字段。
 *
 * @param packageJson package.json 内容
 * @param field 字段名
 * @returns 字符串字段值
 */
function readPackageJsonString(
  packageJson: Record<string, unknown>,
  field: string,
): string | undefined {
  /** package.json 原始字段值 */
  const value = packageJson[field]

  return typeof value === 'string' ? value : undefined
}

/**
 * 将项目路径归一化为绝对路径。
 *
 * @param cwd 当前工作目录
 * @param projectPath 项目产物目录
 * @returns 绝对项目产物目录
 */
function normalizeProjectPath(cwd: string, projectPath: string): string {
  if (path.isAbsolute(projectPath)) {
    return projectPath
  }

  return path.join(cwd, projectPath)
}

/**
 * 解析发布描述。
 *
 * @param input 配置归一化入参
 * @param version 已归一化的版本号
 * @param projectPath 已归一化的项目路径
 * @returns 发布描述
 */
async function resolveDesc<P extends MiniCIPlatform>(
  input: NormalizeConfigInput<P>,
  version: string,
  projectPath: string,
): Promise<string> {
  if (input.args.desc) {
    return input.args.desc
  }

  if (typeof input.config.desc === 'string') {
    return input.config.desc
  }

  if (typeof input.config.desc === 'function') {
    /** 发布描述函数上下文 */
    const context: MiniCIDescContext = {
      operation: input.args.operation,
      platform: input.args.platform,
      version,
      projectPath,
      cwd: input.cwd,
      packageJson: input.packageJson,
    }

    /** 发布描述函数返回值 */
    const resolvedDesc = await input.config.desc(context)

    if (typeof resolvedDesc !== 'string' || resolvedDesc.length === 0) {
      throw new Error('配置校验失败：desc 函数必须返回非空字符串')
    }

    return resolvedDesc
  }

  /** package.json 中的 description */
  const packageDescription = readPackageJsonString(
    input.packageJson,
    'description',
  )

  return packageDescription ?? `CI 自动构建于 ${new Date().toLocaleString()}`
}

/**
 * 将命令行参数、配置文件和 package.json 合并为运行时配置。
 *
 * @param input 配置归一化入参
 * @returns 规范化后的 minici 运行配置
 */
export async function normalizeConfig<P extends MiniCIPlatform>(
  input: NormalizeConfigInput<P>,
): Promise<NormalizedMiniCIConfig<P>> {
  /** 校验后的完整配置 */
  const config = validateConfig(input.config)
  /** 当前平台配置 */
  const platformConfig = validatePlatformConfig(input.args.platform, config)
  /** package.json 中的 version */
  const packageVersion = readPackageJsonString(input.packageJson, 'version')
  /** 归一化后的版本号 */
  const version = input.args.version ?? config.version ?? packageVersion ?? '0.0.0'
  /** 原始项目路径 */
  const rawProjectPath =
    input.args.projectPath ?? config.projectPath ?? `dist/build/${input.args.platform}`
  /** 归一化后的项目路径 */
  const projectPath = normalizeProjectPath(input.cwd, rawProjectPath)
  /** 归一化后的发布描述 */
  const desc = await resolveDesc(
    {
      ...input,
      config,
    },
    version,
    projectPath,
  )

  /** 规范化后的配置 */
  const normalizedConfig = {
    operation: input.args.operation,
    platform: input.args.platform,
    cwd: input.cwd,
    projectPath,
    version,
    desc,
    packageJson: input.packageJson,
    platformConfig,
  } as NormalizedMiniCIConfig<P>

  return normalizedConfig
}
