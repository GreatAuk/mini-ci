import pc from "picocolors";

/** 错误已记录标记 */
const loggedErrorSymbol = Symbol.for("uni-mini-ci.logged-error");

/** 日志接口 */
export interface Logger {
  /** 输出整体运行头 */
  header(message: string, detail?: string): void;
  /** 输出 operation 分组 */
  group(message: string, detail?: string): void;
  /** 输出开始信息 */
  start(message: string, detail?: string): void;
  /** 输出普通信息 */
  info(message: string, detail?: string): void;
  /** 输出提醒信息 */
  remind(message: string, detail?: string): void;
  /** 输出辅助信息 */
  detail(label: string, value: string): void;
  /** 输出警告信息 */
  warn(message: string, detail?: string): void;
  /** 输出错误信息 */
  error(message: string, detail?: string): void;
  /** 输出成功信息 */
  success(message: string, detail?: string): void;
  /** 输出空行 */
  blank(): void;
}

/**
 * 拼接主消息和可选细节。
 *
 * @param message 主消息
 * @param detail 可选细节
 * @returns 完整文本
 */
function joinMessage(message: string, detail?: string): string {
  return detail ? `${message} ${detail}` : message;
}

/**
 * 输出日志行。
 *
 * @param line 日志文本
 */
function writeLine(line: string): void {
  console.log(line);
}

/**
 * 标记错误已经输出过日志。
 *
 * @param error 错误对象
 * @returns 原错误对象
 */
export function markErrorLogged(error: Error): Error {
  Object.defineProperty(error, loggedErrorSymbol, {
    value: true,
    configurable: true,
  });

  return error;
}

/**
 * 判断错误是否已经输出过日志。
 *
 * @param error 未知错误
 * @returns 是否已记录
 */
export function isErrorLogged(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Error & { [loggedErrorSymbol]?: boolean })[loggedErrorSymbol] === true
  );
}

/**
 * 创建带颜色和分组排版的日志实例。
 *
 * @returns Logger 实例
 */
export function createLogger(): Logger {
  return {
    header(message, detail) {
      writeLine(pc.cyan(`● ${joinMessage(message, detail)}`));
    },
    group(message, detail) {
      writeLine(pc.blue(`◇ ${joinMessage(message, detail)}`));
    },
    start(message, detail) {
      writeLine(`  ${pc.cyan("◇")} ${joinMessage(message, detail)}`);
    },
    info(message, detail) {
      writeLine(`  ${pc.blue("i")} ${joinMessage(message, detail)}`);
    },
    remind(message, detail) {
      writeLine(`  ${pc.blue("i")} ${joinMessage(message, detail)}`);
    },
    detail(label, value) {
      writeLine(`  ${pc.gray(label)} ${pc.gray(value)}`);
    },
    warn(message, detail) {
      writeLine(`  ${pc.yellow(`! ${joinMessage(message, detail)}`)}`);
    },
    error(message, detail) {
      writeLine(pc.red(`✕ ${joinMessage(message, detail)}`));
    },
    success(message, detail) {
      writeLine(`  ${pc.green("✓")} ${joinMessage(message, detail)}`);
    },
    blank() {
      writeLine("");
    },
  };
}
