#!/usr/bin/env node
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createLogger, isErrorLogged, runMiniCI } from "./index";

const require = createRequire(import.meta.url);

/** 用法提示文本 */
const HELP_TEXT = `
minici - uniapp 小程序 CI 工具

用法:
  minici --<operation> --platform <platform> [options]

操作:
  --open       打开开发者工具
  --preview    上传开发版并预览
  --upload     上传体验版

选项:
  --platform <platform>       小程序平台 (必填)
  --projectPath <path>        构建产物目录
  --version <version>         发布版本号
  --desc <desc>               发布描述
  --config <path>             配置文件路径
  --cwd <path>                项目根目录
  -h, --help                  显示帮助信息
  -v, --version               显示版本号

支持的平台:
  mp-weixin, mp-alipay, mp-baidu, mp-jd, mp-toutiao

示例:
  minici --upload --platform mp-weixin
  minici --preview --platform mp-alipay --projectPath dist/build/mp-alipay
`.trim();

/**
 * CLI 入口，解析命令行参数并执行 minici 流程。
 *
 * @param argv CLI 参数
 * @param cwd 当前工作目录
 */
export async function main(argv = process.argv.slice(2), cwd = process.cwd()): Promise<void> {
  if (argv.includes("-h") || argv.includes("--help") || argv.includes("help")) {
    console.log(HELP_TEXT);
    return;
  }

  if (argv.includes("-v") || (argv.includes("--version") && argv.length === 1)) {
    const pkg = require("../package.json") as { version: string };
    console.log(pkg.version);
    return;
  }

  try {
    const result = await runMiniCI({
      argv,
      cwd,
    });

    process.exitCode = result.success ? 0 : 1;
  } catch (error) {
    if (!isErrorLogged(error)) {
      /** CLI 顶层 logger */
      const logger = createLogger();
      /** 错误消息 */
      const message = error instanceof Error ? error.message : String(error);

      logger.error("执行失败");
      logger.detail("error", message);
    }

    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
