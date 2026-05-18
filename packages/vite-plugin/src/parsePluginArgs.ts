import minimist from "minimist";
import { supportedOperations } from "uni-mini-ci-core";

import type { MiniCIOperation } from "uni-mini-ci-core";

/** Vite 插件参数解析结果 */
export interface ParsedPluginArgs {
  /** 当前操作列表；空数组表示跳过插件执行 */
  operations: MiniCIOperation[];
  /** 是否执行 bumpp 版本更新 */
  bump?: boolean;
}

/** Vite 插件模式支持的参数名 */
const allowedOptionNames = new Set(["open", "preview", "upload", "bump"]);

/**
 * 读取第一个透传分隔符后的插件参数。
 *
 * @param argv 完整进程参数或测试传入的参数数组
 * @returns 插件参数数组
 */
function readPluginArgv(argv: string[]): string[] {
  /** 透传分隔符位置 */
  const separatorIndex = argv.indexOf("--");

  if (separatorIndex < 0) {
    return [];
  }

  return argv.slice(separatorIndex + 1);
}

/**
 * 校验插件模式是否传入未知参数。
 *
 * @param options minimist 解析结果
 */
function assertKnownOptions(options: minimist.ParsedArgs): void {
  for (const optionName of Object.keys(options)) {
    if (optionName === "_") {
      continue;
    }

    if (!allowedOptionNames.has(optionName)) {
      throw new Error(`Vite 插件模式暂不支持参数：--${optionName}`);
    }
  }
}

/**
 * 解析 Vite 插件透传参数。
 *
 * @param argv 完整进程参数或测试传入的参数数组
 * @returns 已解析插件参数
 */
export function parsePluginArgs(argv: string[]): ParsedPluginArgs {
  /** 插件透传参数 */
  const pluginArgv = readPluginArgv(argv);

  if (pluginArgv.length === 0) {
    return { operations: [] };
  }

  /** minimist 解析结果 */
  const options = minimist(pluginArgv, {
    boolean: [...supportedOperations, "bump"],
    string: [],
    alias: {},
    "--": false,
  });

  if (options._.length > 0) {
    throw new Error(`Vite 插件模式暂不支持位置参数：${options._.join(" ")}`);
  }

  assertKnownOptions(options);

  /** 已传入操作列表 */
  const operations = supportedOperations.filter((operation) => options[operation] === true);
  /** 是否执行 bumpp 版本更新 */
  const bump = options.bump === true;

  if (bump && operations.length > 0 && !operations.includes("upload")) {
    throw new Error("bump 搭配 CI 操作时必须包含 upload");
  }

  if (operations.length === 0 && !bump) {
    return { operations: [] };
  }

  return {
    operations,
    ...(bump && { bump: true }),
  };
}
