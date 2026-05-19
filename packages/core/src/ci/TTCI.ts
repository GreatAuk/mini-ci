import path from "node:path";
import { getNpmPkgSync } from "../utils/npm";
import { printQrcode2Terminal } from "../utils/qrcode";
import { BaseCI } from "./BaseCI";

/** 字节小程序 CI 适配器 */
export class TTCI extends BaseCI<"mp-toutiao"> {
  /** tt-ide-cli 模块 */
  private tt: any;

  /**
   * 加载 tt-ide-cli 模块。
   *
   * @returns tt-ide-cli 模块实例
   */
  private loadTT(): any {
    if (!this.tt) {
      try {
        this.tt = getNpmPkgSync("tt-ide-cli", this.config.cwd);
      } catch {
        throw new Error("当前平台 mp-toutiao 需要安装依赖：tt-ide-cli");
      }
    }

    return this.tt;
  }

  async init(): Promise<void> {
    this.loadTT();
  }

  /**
   * 登录字节小程序。
   */
  private async beforeCheck(): Promise<void> {
    const ttConfig = this.requirePlatformConfig();
    await this.tt.loginByEmail({
      email: ttConfig.email,
      password: ttConfig.password,
      dontSaveCookie: false,
    });
  }

  async open() {
    try {
      const tt = this.tt || this.loadTT();
      this.logger.start("启动抖音小程序开发者工具", this.config.projectPath);
      await tt.open({
        project: {
          path: this.config.projectPath,
        },
      });
      this.logger.success("打开 IDE 成功");
      return this.createResult(true);
    } catch (error) {
      throw new Error(
        `mp-toutiao open 执行失败：${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async preview() {
    await this.beforeCheck();
    try {
      this.logger.start("预览抖音小程序");
      const previewQrcodePath =
        this.config.qrcodePath?.preview ?? path.join(this.config.projectPath, "preview.png");
      const ttConfig = this.requirePlatformConfig();

      const previewResult = await this.tt.preview({
        project: {
          path: this.config.projectPath,
        },
        page: {
          path: "",
        },
        qrcode: {
          format: "imageFile",
          output: previewQrcodePath,
        },
        copyToClipboard: true,
        cache: true,
        ideConfig: {
          skipDomainCheck: ttConfig.setting?.skipDomainCheck,
        },
      });

      this.logger.success("开发版上传成功", new Date().toLocaleString());
      const qrContent = previewResult.shortUrl as string;
      await printQrcode2Terminal(qrContent);
      this.logger.success("预览二维码已生成");
      this.logger.detail("path", previewQrcodePath);
      this.logger.detail("qr", qrContent);
      this.logger.detail("expire", new Date(previewResult.expireTime * 1000).toLocaleString());

      return this.createResult(true, {
        qrCodeContent: qrContent,
        qrCodeLocalPath: previewQrcodePath,
      });
    } catch (error) {
      throw new Error(
        `mp-toutiao preview 执行失败：${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async upload() {
    await this.beforeCheck();
    try {
      this.logger.start("上传代码到抖音开放平台后台");
      this.logger.detail("version", this.config.version);
      this.logger.detail("desc", this.config.desc);
      const uploadQrcodePath =
        this.config.qrcodePath?.upload ?? path.join(this.config.projectPath, "upload.png");

      const uploadResult = await this.tt.upload({
        project: {
          path: this.config.projectPath,
        },
        qrcode: {
          format: "imageFile",
          output: uploadQrcodePath,
        },
        version: this.config.version,
        changeLog: this.config.desc,
        needUploadSourcemap: true,
        copyToClipboard: false,
      });

      this.logger.success("体验版上传成功", new Date().toLocaleString());
      const qrContent = uploadResult.shortUrl as string;
      await printQrcode2Terminal(qrContent);
      this.logger.success("体验版二维码已生成");
      this.logger.detail("path", uploadQrcodePath);
      this.logger.detail("qr", qrContent);
      this.logger.detail("expire", new Date(uploadResult.expireTime * 1000).toLocaleString());

      return this.createResult(true, {
        qrCodeContent: qrContent,
        qrCodeLocalPath: uploadQrcodePath,
      });
    } catch (error) {
      throw new Error(
        `mp-toutiao upload 执行失败：${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
