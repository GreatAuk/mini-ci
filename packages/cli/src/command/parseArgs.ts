import { CAC } from "cac";
import { supportedOperations, supportedPlatforms } from "uni-mini-ci-core";

import type { MiniCIOperation, MiniCIPlatform, ParsedCliArgs } from "uni-mini-ci-core";

/** CAC 解析后的选项结构 */
interface ParsedOptions {
  /** 透传参数分隔符 */
  "--"?: unknown[];
  /** 小程序平台 */
  platform?: unknown;
  /** 项目产物目录 */
  projectPath?: unknown;
  /** 发布版本 */
  version?: unknown;
  /** 发布描述 */
  desc?: unknown;
  /** 配置文件路径 */
  config?: unknown;
  /** 当前工作目录 */
  cwd?: unknown;
  /** 打开开发者工具 */
  open?: unknown;
  /** 上传开发版并生成预览二维码 */
  preview?: unknown;
  /** 上传体验版 */
  upload?: unknown;
  /** 是否为开发构建 */
  dev?: unknown;
}

/** 允许出现的 CAC 选项名 */
const allowedOptionNames = new Set([
  "--",
  "h",
  "help",
  "platform",
  "projectPath",
  "version",
  "desc",
  "config",
  "cwd",
  "open",
  "preview",
  "upload",
  "dev",
]);

/**
 * 判断字符串是否为支持的 CLI 操作。
 *
 * @param value 待判断的操作字符串
 * @returns 是否为支持的操作
 */
export function isOperation(value: string): value is MiniCIOperation {
  return supportedOperations.includes(value as MiniCIOperation);
}

/**
 * 判断字符串是否为支持的 uniapp 小程序平台。
 *
 * @param value 待判断的平台字符串
 * @returns 是否为支持的平台
 */
export function isPlatform(value: string): value is MiniCIPlatform {
  return supportedPlatforms.includes(value as MiniCIPlatform);
}

/**
 * 读取字符串选项，过滤掉未传值或布尔标记。
 *
 * @param value CAC 解析出的原始选项值
 * @returns 字符串选项值
 */
function readStringOption(name: string, value: unknown): string | undefined {
  if (value === true) {
    throw new Error(`--${name} 需要提供字符串值`);
  }

  return typeof value === "string" ? value : undefined;
}

/**
 * 校验是否传入了未支持的命令行选项。
 *
 * @param options CAC 解析出的原始选项对象
 */
function assertKnownOptions(options: ParsedOptions): void {
  for (const optionName of Object.keys(options)) {
    if (!allowedOptionNames.has(optionName)) {
      throw new Error(`暂不支持参数：--${optionName}`);
    }
  }
}

/**
 * 创建用于解析 minici 命令参数的 CAC 实例。
 *
 * @returns 已注册全局选项的 CAC 实例
 */
function createCliParser(): CAC {
  /** CLI 参数解析器 */
  const cli = new CAC("minici");

  cli
    .option("--platform <platform>", "uniapp 小程序平台")
    .option("--open", "打开开发者工具")
    .option("--preview", "上传开发版并生成预览二维码")
    .option("--upload", "上传体验版")
    .option("--projectPath <projectPath>", "小程序构建产物目录")
    .option("--version <version>", "发布版本")
    .option("--desc <desc>", "发布描述")
    .option("--config <config>", "配置文件路径")
    .option("--cwd <cwd>", "当前工作目录")
    .option("--dev", "标记为开发构建，默认 projectPath 使用 dist/dev/<platform>");

  return cli;
}

/**
 * 解析 CLI argv 参数。
 *
 * @param argv 不包含 node 和入口文件路径的命令参数
 * @returns 解析并校验后的 CLI 参数
 */
export function parseCliArgs(argv: string[]): ParsedCliArgs {
  /** CLI 参数解析器 */
  const cli = createCliParser();
  /** CAC 需要接收包含 node 和入口文件的完整 argv */
  const fullArgv = ["node", "minici", ...argv];
  /** CAC 解析结果 */
  const parsed = cli.parse(fullArgv, { run: false });
  /** 额外位置参数 */
  const extraArgs = parsed.args;

  if (extraArgs.length > 0) {
    throw new Error(`暂不支持位置参数：${extraArgs.join(" ")}`);
  }

  /** CAC 解析出的原始选项 */
  const options = parsed.options as ParsedOptions;
  assertKnownOptions(options);
  /** 命令行传入的操作参数列表 */
  const operations = supportedOperations.filter((operation) => options[operation] === true);

  if (operations.length === 0) {
    throw new Error(
      "请指定操作，可选值：--open、--preview、--upload\n用法：minici --<operation> --platform <platform>",
    );
  }

  /** 原始平台参数 */
  const rawPlatform = readStringOption("platform", options.platform);

  if (!rawPlatform) {
    throw new Error(
      "请指定平台，可选值：mp-weixin、mp-alipay、mp-baidu、mp-jd、mp-toutiao\n用法：minici --<operation> --platform <platform>",
    );
  }

  if (!isPlatform(rawPlatform)) {
    throw new Error(
      `暂不支持平台：${rawPlatform}\n可选值：mp-weixin、mp-alipay、mp-baidu、mp-jd、mp-toutiao`,
    );
  }

  /** 已解析的 CLI 参数 */
  const cliArgs: ParsedCliArgs = {
    operations,
    platform: rawPlatform,
  };
  /** 项目产物目录 */
  const projectPath = readStringOption("projectPath", options.projectPath);
  /** 发布版本 */
  const version = readStringOption("version", options.version);
  /** 发布描述 */
  const desc = readStringOption("desc", options.desc);
  /** 配置文件路径 */
  const config = readStringOption("config", options.config);
  /** 当前工作目录 */
  const cwd = readStringOption("cwd", options.cwd);

  if (projectPath) {
    cliArgs.projectPath = projectPath;
  }

  if (version) {
    cliArgs.version = version;
  }

  if (desc) {
    cliArgs.desc = desc;
  }

  if (config) {
    cliArgs.config = config;
  }

  if (cwd) {
    cliArgs.cwd = cwd;
  }

  if (options.dev === true) {
    cliArgs.dev = true;
  }

  return cliArgs;
}
