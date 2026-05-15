import crypto from "node:crypto";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import shell from "shelljs";
import { getNpmPkgSync } from "../utils/npm";
import {
  generateQrcodeImageFile,
  printQrcode2Terminal,
  readQrcodeImageContent,
} from "../utils/qrcode";
import { BaseCI } from "./BaseCI";

/** 微信小程序 CI 适配器 */
export class WeappCI extends BaseCI<"mp-weixin"> {
  /** miniprogram-ci Project 实例 */
  private instance: unknown;
  /** miniprogram-ci 模块 */
  private ci: any;
  /** 微信开发者工具安装路径 */
  private devToolsInstallPath = "";

  async init(): Promise<void> {
    const weappConfig = this.config.platformConfig;

    try {
      this.ci = getNpmPkgSync("miniprogram-ci", this.config.cwd);
    } catch {
      throw new Error("当前平台 mp-weixin 需要安装依赖：miniprogram-ci");
    }

    this.devToolsInstallPath =
      weappConfig.devToolsInstallPath ||
      (process.platform === "darwin"
        ? "/Applications/wechatwebdevtools.app"
        : "C:\\Program Files (x86)\\Tencent\\微信web开发者工具");

    const privateKeyPath = path.isAbsolute(weappConfig.privateKeyPath)
      ? weappConfig.privateKeyPath
      : path.join(this.config.cwd, weappConfig.privateKeyPath);

    if (!existsSync(privateKeyPath)) {
      throw new Error(`mp-weixin.privateKeyPath 路径不存在：${privateKeyPath}`);
    }

    this.instance = new this.ci.Project({
      type: weappConfig.type || "miniProgram",
      projectPath: this.config.projectPath,
      appid: weappConfig.appid,
      privateKeyPath,
      ignores: weappConfig.ignores,
    });
  }

  async open() {
    if (!existsSync(this.devToolsInstallPath)) {
      throw new Error(`微信开发者工具安装路径不存在：${this.devToolsInstallPath}`);
    }

    const cliPath = path.join(
      this.devToolsInstallPath,
      os.platform() === "win32" ? "/cli.bat" : "/Contents/MacOS/cli",
    );

    const isWindows = os.platform() === "win32";
    const installPath = isWindows
      ? this.devToolsInstallPath
      : `${this.devToolsInstallPath}/Contents/MacOS`;
    const md5 = crypto.createHash("md5").update(installPath).digest("hex");
    const ideStatusFile = path.join(
      os.homedir(),
      isWindows
        ? `/AppData/Local/微信开发者工具/User Data/${md5}/Default/.ide-status`
        : `/Library/Application Support/微信开发者工具/${md5}/Default/.ide-status`,
    );

    if (!existsSync(ideStatusFile)) {
      throw new Error(
        "工具的服务端口已关闭。要使用命令行调用工具，请打开工具 -> 设置 -> 安全设置，将服务端口开启。",
      );
    }

    if (!existsSync(cliPath)) {
      throw new Error(`命令行工具路径不存在：${cliPath}`);
    }

    this.logger.start("微信开发者工具", this.config.projectPath);
    shell.exec(`${cliPath} open --project ${this.config.projectPath}`);

    return this.createResult(true);
  }

  async preview() {
    try {
      this.logger.start("上传开发版代码到微信后台并预览");
      const previewQrcodePath =
        this.config.qrcodePath?.preview ?? path.join(this.config.projectPath, "preview.jpg");
      const weappConfig = this.config.platformConfig;

      const uploadResult = await this.ci.preview({
        project: this.instance,
        version: this.config.version,
        desc: this.config.desc,
        onProgressUpdate: undefined,
        robot: weappConfig.robot,
        setting: weappConfig.setting,
        qrcodeFormat: "image",
        qrcodeOutputDest: previewQrcodePath,
      });

      if (uploadResult.subPackageInfo) {
        const allPackageInfo = uploadResult.subPackageInfo.find(
          (item: any) => item.name === "__FULL__",
        );
        const mainPackageInfo = uploadResult.subPackageInfo.find(
          (item: any) => item.name === "__APP__",
        );
        const extInfo = `本次上传${allPackageInfo!.size / 1024}kb ${mainPackageInfo ? ",其中主包" + mainPackageInfo.size / 1024 + "kb" : ""}`;
        this.logger.success("开发版上传成功", `${new Date().toLocaleString()} ${extInfo}`);
      }

      let qrContent: string | undefined;
      try {
        qrContent = await readQrcodeImageContent(previewQrcodePath);
        await printQrcode2Terminal(qrContent);
        this.logger.success("预览二维码已生成");
        this.logger.detail("path", previewQrcodePath);
        this.logger.detail("qr", qrContent);
      } catch (error) {
        this.logger.warn("获取预览二维码失败", error instanceof Error ? error.message : String(error));
      }

      return this.createResult(true, {
        qrCodeContent: qrContent,
        qrCodeLocalPath: previewQrcodePath,
      });
    } catch (error) {
      throw new Error(
        `mp-weixin preview 执行失败：${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async upload() {
    try {
      this.logger.start("上传体验版代码到微信后台");
      this.logger.detail("version", this.config.version);
      this.logger.detail("desc", this.config.desc);
      const weappConfig = this.config.platformConfig;

      const uploadResult = await this.ci.upload({
        project: this.instance,
        version: this.config.version,
        desc: this.config.desc,
        onProgressUpdate: undefined,
        robot: weappConfig.robot,
        setting: weappConfig.setting,
      });

      if (uploadResult.subPackageInfo) {
        const allPackageInfo = uploadResult.subPackageInfo.find(
          (item: any) => item.name === "__FULL__",
        );
        const mainPackageInfo = uploadResult.subPackageInfo.find(
          (item: any) => item.name === "__APP__",
        );
        const extInfo = `本次上传${allPackageInfo!.size / 1024}kb ${mainPackageInfo ? ",其中主包" + mainPackageInfo.size / 1024 + "kb" : ""}`;
        this.logger.success("上传成功", `${new Date().toLocaleString()} ${extInfo}`);
      }

      const uploadQrcodePath =
        this.config.qrcodePath?.upload ?? path.join(this.config.projectPath, "upload.png");
      let qrContent: string | undefined;
      try {
        qrContent = `https://open.weixin.qq.com/sns/getexpappinfo?appid=${weappConfig.appid}#wechat-redirect`;
        await printQrcode2Terminal(qrContent);
        await generateQrcodeImageFile(uploadQrcodePath, qrContent);
        this.logger.success("体验版二维码已生成");
        this.logger.detail("path", uploadQrcodePath);
        this.logger.detail("qr", qrContent);
      } catch (error) {
        this.logger.warn("体验二维码生成失败", error instanceof Error ? error.message : String(error));
      }

      return this.createResult(true, {
        qrCodeContent: qrContent,
        qrCodeLocalPath: uploadQrcodePath,
      });
    } catch (error) {
      throw new Error(
        `mp-weixin upload 执行失败：${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
