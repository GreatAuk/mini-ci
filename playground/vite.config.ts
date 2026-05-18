import { defineConfig } from "vite";
import uni from "@uni-helper/plugin-uni";
import { uniMiniCI } from "vite-plugin-uni-mini-ci";
import readline from "node:readline/promises";
import process from "node:process";

import { config } from "./config";

async function getDesc() {
  // 当前执行的 npm 脚本
  const npmScript = process.env.npm_lifecycle_event;

  // 只有 npm 命令以 :upload:release 结尾才需要填写更新备注，约定 npm 脚本以 :upload 结尾就是上传
  if (npmScript?.endsWith(":upload:release")) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const desc = await rl.question("请填写更新备注(如不填写，默认：优化体验，修复缺陷)：");
    rl.close();
    return desc;
  }
  if (npmScript?.endsWith(":test")) return "优化体验，修复缺陷 [测试环境接口]";

  return "";
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
    uniMiniCI({
      desc: async () => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const desc = await rl.question("请填写更新备注(如不填写，默认：优化体验，修复缺陷)：");
        rl.close();
        return desc;
      },
      bumpOptions: {
        commit: true,
      },
      "mp-weixin": {
        appid: config["mp-weixin"].appid,
        privateKeyPath: config["mp-weixin"].privateKeyPath,
      },
      "mp-alipay": {
        appid: "test",
        toolId: "test",
        privateKey: "test",
      },
    }),
  ],
});
