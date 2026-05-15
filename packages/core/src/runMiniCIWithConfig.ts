import { access } from "node:fs/promises";
import { createCI } from "./ci/registry";
import { loadPackageJson } from "./config/loadPackageJson";
import { normalizeConfig } from "./config/normalize";
import { createLogger, markErrorLogged } from "./runtime/logger";

import type {
  MiniCICompleteHookData,
  MiniCIErrorHookData,
  MiniCIOperation,
  MiniCIResult,
  MiniCISingleResult,
  NormalizedMiniCIConfig,
  RunMiniCIWithConfigOptions,
} from "./types";

/**
 * 校验项目产物目录是否存在。
 *
 * @param projectPath 项目产物目录绝对路径
 */
async function assertPathExists(projectPath: string): Promise<void> {
  try {
    await access(projectPath);
  } catch {
    throw new Error(`projectPath 不存在：${projectPath}`);
  }
}

/**
 * 判断操作是否有 complete hook。
 *
 * @param operation 当前操作
 * @returns 是否为 preview 或 upload 操作
 */
function hasCompleteHook(operation: MiniCIOperation): operation is "preview" | "upload" {
  return operation === "preview" || operation === "upload";
}

/**
 * 将未知抛出值归一化为 Error。
 *
 * @param error 未知抛出值
 * @returns Error 对象
 */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

/** operation 展示文案 */
const operationMessages: Record<MiniCIOperation, string> = {
  open: "打开开发者工具",
  preview: "上传开发版并生成预览码",
  upload: "上传体验版并生成体验码",
};

/**
 * 输出错误摘要并标记错误。
 *
 * @param input 错误上下文
 */
function logFailure(input: {
  logger: ReturnType<typeof createLogger>;
  error: Error;
  operation?: MiniCIOperation;
  platform?: RunMiniCIWithConfigOptions["args"]["platform"];
}): void {
  input.logger.error("执行失败");

  if (input.operation) {
    input.logger.detail("operation", input.operation);
  }

  if (input.platform) {
    input.logger.detail("platform", input.platform);
  }

  input.logger.detail("error", input.error.message);
  markErrorLogged(input.error);
}

/**
 * 给错误补充 cause，并保留本次原始错误。
 *
 * @param error 当前错误
 * @param cause 原始错误
 * @returns 带 cause 的错误
 */
function attachCause(error: Error, cause: Error): Error {
  /** 带 cause 扩展字段的错误对象 */
  const errorWithCause = error as Error & {
    cause?: unknown;
    previousCause?: unknown;
  };
  /** 当前错误原有 cause */
  const previousCause = errorWithCause.cause;

  if (previousCause !== undefined && previousCause !== cause && !("previousCause" in error)) {
    Object.defineProperty(error, "previousCause", {
      value: previousCause,
      configurable: true,
    });
  }

  Object.defineProperty(error, "cause", {
    value: cause,
    configurable: true,
  });

  return error;
}

/**
 * 创建 complete hook 数据。
 *
 * @param input complete hook 上下文
 * @returns complete hook 数据
 */
function createCompleteHookData(input: {
  success: boolean;
  normalized: NormalizedMiniCIConfig;
  result?: MiniCISingleResult;
  error?: Error;
}): MiniCICompleteHookData {
  /** complete hook 数据 */
  const data: MiniCICompleteHookData = {
    success: input.success,
    data: {
      platform: input.normalized.platform,
      version: input.normalized.version,
      desc: input.normalized.desc,
      projectPath: input.normalized.projectPath,
    },
  };

  if (input.result?.qrCodeLocalPath) {
    data.data.qrCodeLocalPath = input.result.qrCodeLocalPath;
  }

  if (input.result?.qrCodeContent) {
    data.data.qrCodeContent = input.result.qrCodeContent;
  }

  if (input.error) {
    data.error = input.error;
  }

  return data;
}

/**
 * 创建 onError hook 数据。
 *
 * @param input 错误 hook 上下文
 * @returns 错误 hook 数据
 */
function createErrorHookData(input: {
  error: Error;
  operation?: MiniCIOperation;
  platform?: RunMiniCIWithConfigOptions["args"]["platform"];
  normalized?: NormalizedMiniCIConfig;
  result?: MiniCISingleResult;
}): MiniCIErrorHookData {
  /** 已知上下文字段 */
  const data: NonNullable<MiniCIErrorHookData["data"]> = {};
  /** 当前平台 */
  const platform = input.normalized?.platform ?? input.platform;

  if (platform) {
    data.platform = platform;
  }

  if (input.normalized) {
    data.version = input.normalized.version;
    data.desc = input.normalized.desc;
    data.projectPath = input.normalized.projectPath;
  }

  if (input.result?.qrCodeLocalPath) {
    data.qrCodeLocalPath = input.result.qrCodeLocalPath;
  }

  if (input.result?.qrCodeContent) {
    data.qrCodeContent = input.result.qrCodeContent;
  }

  /** 错误 hook 数据 */
  const hookData: MiniCIErrorHookData = {
    error: input.error,
  };

  if (input.operation) {
    hookData.operation = input.operation;
  }

  if (platform) {
    hookData.platform = platform;
  }

  if (Object.keys(data).length > 0) {
    hookData.data = data;
  }

  return hookData;
}

/**
 * 触发 preview/upload complete hook。
 *
 * @param input complete hook 上下文
 */
async function triggerCompleteHook(input: {
  options: RunMiniCIWithConfigOptions;
  operation: MiniCIOperation;
  data: MiniCICompleteHookData;
}): Promise<void> {
  if (input.operation === "preview") {
    await input.options.config.hooks?.onPreviewComplete?.(input.data);
    return;
  }

  if (input.operation === "upload") {
    await input.options.config.hooks?.onUploadComplete?.(input.data);
  }
}

/**
 * 触发 onError hook；onError 自身失败时抛出 onError 错误，并保留原始 cause。
 *
 * @param options 共享执行入口选项
 * @param data 错误 hook 数据
 */
async function triggerErrorHook(
  options: RunMiniCIWithConfigOptions,
  data: MiniCIErrorHookData,
): Promise<void> {
  try {
    await options.config.hooks?.onError?.(data);
  } catch (error) {
    throw attachCause(toError(error), data.error);
  }
}

/**
 * 使用已解析参数和显式配置运行 minici 流程。
 *
 * @param options 共享执行入口选项
 * @returns minici 执行结果
 */
export async function runMiniCIWithConfig(
  options: RunMiniCIWithConfigOptions,
): Promise<MiniCIResult> {
  const logger = createLogger();
  const packageJson = await loadPackageJson(options.cwd);
  const results: MiniCIResult["results"] = [];
  let didPrintHeader = false;

  for (const operation of options.args.operations) {
    /** 当前操作的归一化配置 */
    let normalized!: NormalizedMiniCIConfig;

    try {
      normalized = await normalizeConfig({
        args: {
          ...options.args,
          operation,
        },
        cwd: options.cwd,
        config: options.config,
        packageJson,
      });

      if (!didPrintHeader) {
        logger.header("minici", `${normalized.platform} · ${normalized.version}`);
        logger.detail("projectPath", normalized.projectPath);
        logger.detail("operations", options.args.operations.join(", "));
        didPrintHeader = true;
      }

      logger.blank();
      logger.group(operation, operationMessages[operation]);
    } catch (error) {
      /** 配置归一化错误 */
      const runtimeError = toError(error);
      logFailure({
        logger,
        error: runtimeError,
        operation,
        platform: options.args.platform,
      });
      await triggerErrorHook(
        options,
        createErrorHookData({
          error: runtimeError,
          operation,
          platform: options.args.platform,
        }),
      );
      throw runtimeError;
    }

    try {
      await assertPathExists(normalized.projectPath);
    } catch (error) {
      /** 项目路径错误 */
      const pathError = toError(error);
      logFailure({
        logger,
        error: pathError,
        operation,
        platform: options.args.platform,
      });
      await triggerErrorHook(
        options,
        createErrorHookData({
          error: pathError,
          operation,
          platform: options.args.platform,
          normalized,
        }),
      );
      throw pathError;
    }

    /** 当前平台 CI 实例 */
    const ci = createCI(normalized, logger);

    try {
      await ci.init();
    } catch (error) {
      /** 初始化错误 */
      const initError = toError(error);
      logFailure({
        logger,
        error: initError,
        operation,
        platform: options.args.platform,
      });
      await triggerErrorHook(
        options,
        createErrorHookData({
          error: initError,
          operation,
          platform: options.args.platform,
          normalized,
        }),
      );
      throw initError;
    }

    /** 当前操作执行结果 */
    let result: MiniCISingleResult;

    try {
      result = await ci[operation]();
    } catch (error) {
      /** CI 方法错误 */
      const ciError = toError(error);

      if (hasCompleteHook(operation)) {
        try {
          await triggerCompleteHook({
            options,
            operation,
            data: createCompleteHookData({
              success: false,
              normalized,
              error: ciError,
            }),
          });
        } catch (hookError) {
          /** complete hook 错误 */
          const completeHookError = attachCause(toError(hookError), ciError);
          logFailure({
            logger,
            error: completeHookError,
            operation,
            platform: options.args.platform,
          });
          await triggerErrorHook(
            options,
            createErrorHookData({
              error: completeHookError,
              operation,
              platform: options.args.platform,
              normalized,
            }),
          );
          throw completeHookError;
        }
      }

      logFailure({
        logger,
        error: ciError,
        operation,
        platform: options.args.platform,
      });
      await triggerErrorHook(
        options,
        createErrorHookData({
          error: ciError,
          operation,
          platform: options.args.platform,
          normalized,
        }),
      );
      throw ciError;
    }

    if (hasCompleteHook(operation)) {
      try {
        await triggerCompleteHook({
          options,
          operation,
          data: createCompleteHookData({
            success: true,
            normalized,
            result,
          }),
        });
      } catch (error) {
        /** complete hook 错误 */
        const hookError = toError(error);
        logFailure({
          logger,
          error: hookError,
          operation,
          platform: options.args.platform,
        });
        await triggerErrorHook(
          options,
          createErrorHookData({
            error: hookError,
            operation,
            platform: options.args.platform,
            normalized,
            result,
          }),
        );
        throw hookError;
      }
    }

    if (result.qrCodeLocalPath) {
      logger.success("二维码已保存");
      logger.detail("path", result.qrCodeLocalPath);
    }

    if (result.qrCodeContent) {
      logger.detail("qr", result.qrCodeContent);
    }

    results.push(result);
  }

  logger.blank();
  logger.success("完成", `${results.length} 个操作执行成功`);

  const firstResult = results[0];

  return {
    success: results.every((result) => result.success),
    operations: options.args.operations,
    platform: firstResult.platform,
    version: firstResult.version,
    desc: firstResult.desc,
    projectPath: firstResult.projectPath,
    results,
  };
}
