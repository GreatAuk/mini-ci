import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { compareVersion } from "../utils/compareVersion";
import { getNpmPkgSync } from "../utils/npm";
import {
  generateQrcodeImageFile,
  printQrcode2Terminal,
  readQrcodeImageContent,
} from "../utils/qrcode";
import { BaseCI } from "./BaseCI";

/** 支付宝小程序 CI 适配器 */
export class AlipayCI extends BaseCI<"mp-alipay"> {
  /** minidev 模块实例 */
  private minidev: any;

  async init(): Promise<void> {
    const alipayConfig = this.config.platformConfig;

    try {
      this.minidev = getNpmPkgSync("minidev", this.config.cwd);
    } catch {
      throw new Error("当前平台 mp-alipay 需要安装依赖：minidev");
    }

    let privateKey = alipayConfig.privateKey;
    if (!privateKey) {
      const privateKeyPath = alipayConfig.privateKeyPath
        ? path.isAbsolute(alipayConfig.privateKeyPath)
          ? alipayConfig.privateKeyPath
          : path.join(this.config.cwd, alipayConfig.privateKeyPath)
        : undefined;

      if (!privateKeyPath || !existsSync(privateKeyPath)) {
        throw new Error(`mp-alipay.privateKeyPath 路径不存在：${privateKeyPath || "未配置"}`);
      }

      privateKey = readFileSync(privateKeyPath, "utf-8");
    }

    this.minidev.useDefaults({
      config: {
        defaults: {
          "alipay.authentication.privateKey": privateKey,
          "alipay.authentication.toolId": alipayConfig.toolId,
        },
      },
    });
  }

  async open() {
    const alipayConfig = this.config.platformConfig;
    try {
      this.logger.start("小程序开发者工具", this.config.projectPath);
      await this.minidev.minidev.startIde(
        Object.assign(
          { project: this.config.projectPath },
          alipayConfig.devToolsInstallPath ? { appPath: alipayConfig.devToolsInstallPath } : {},
        ),
      );
      return this.createResult(true);
    } catch (error) {
      throw new Error(`mp-alipay open 执行失败：${error instanceof Error ? error.message : error}`);
    }
  }

  async preview() {
    const { appid: appId, clientType = "alipay" } = this.config.platformConfig;
    try {
      const previewResult = await this.minidev.minidev.preview({
        project: this.config.projectPath,
        appId,
        clientType,
        autoPush: false,
      });

      const previewQrcodePath =
        this.config.qrcodePath?.preview ?? path.join(this.config.projectPath, "preview.png");
      const qrcodeUrl = previewResult.qrcodeUrl;
      const qrcodeContent = await readQrcodeImageContent(qrcodeUrl);
      await generateQrcodeImageFile(previewQrcodePath, qrcodeContent);
      this.logger.success("预览版二维码已生成");
      this.logger.detail("path", previewQrcodePath);
      this.logger.detail("qr", qrcodeContent);

      return this.createResult(true, {
        qrCodeContent: qrcodeContent,
        qrCodeLocalPath: previewQrcodePath,
      });
    } catch (error) {
      throw new Error(
        `mp-alipay preview 执行失败：${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async upload() {
    const { clientType = "alipay", appid: appId, deleteVersion } = this.config.platformConfig;
    this.logger.start("上传代码到阿里小程序后台", clientType);

    try {
      const lasterVersion = await this.minidev.minidev.app.getUploadedVersion({
        appId,
        clientType,
      });

      if (this.config.version && compareVersion(this.config.version, lasterVersion) <= 0) {
        this.logger.warn(
          "上传版本号必须大于最新上传版本",
          `"${this.config.version}" <= "${lasterVersion}"`,
        );
      }

      const result = await this.minidev.minidev.upload({
        project: this.config.projectPath,
        appId,
        version: this.config.version,
        clientType,
        experience: true,
        deleteVersion: deleteVersion || lasterVersion,
      });

      const qrcodeUrl = result.experienceQrCodeUrl!;
      const qrcodeContent = await readQrcodeImageContent(qrcodeUrl);
      const uploadQrcodePath =
        this.config.qrcodePath?.upload ?? path.join(this.config.projectPath, "upload.png");
      await printQrcode2Terminal(qrcodeContent);
      await generateQrcodeImageFile(uploadQrcodePath, qrcodeContent);
      this.logger.success("体验版二维码已生成");
      this.logger.detail("path", uploadQrcodePath);
      this.logger.detail("qr", qrcodeContent);

      return this.createResult(true, {
        qrCodeContent: qrcodeContent,
        qrCodeLocalPath: uploadQrcodePath,
      });
    } catch (error) {
      throw new Error(
        `mp-alipay upload 执行失败：${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
