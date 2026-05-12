import pc from 'picocolors'

/** 日志接口 */
export interface Logger {
  /** 输出开始信息 */
  start(message: string, detail?: string): void
  /** 输出提醒信息 */
  remind(message: string, detail?: string): void
  /** 输出警告信息 */
  warn(message: string, detail?: string): void
  /** 输出错误信息 */
  error(message: string, detail?: string): void
  /** 输出成功信息 */
  success(message: string, detail?: string): void
}

/**
 * 打印带标签的日志行。
 *
 * @param label 标签文本
 * @param message 日志消息
 * @param detail 可选附加细节
 */
function print(label: string, message: string, detail?: string): void {
  console.log(detail ? `${label} ${message} ${detail}` : `${label} ${message}`)
}

/**
 * 创建带颜色标签的日志实例。
 *
 * @returns Logger 实例
 */
export function createLogger(): Logger {
  return {
    start(message, detail) {
      print(pc.cyan('start'), message, detail)
    },
    remind(message, detail) {
      print(pc.blue('info'), message, detail)
    },
    warn(message, detail) {
      print(pc.yellow('warn'), message, detail)
    },
    error(message, detail) {
      print(pc.red('error'), message, detail)
    },
    success(message, detail) {
      print(pc.green('success'), message, detail)
    },
  }
}
