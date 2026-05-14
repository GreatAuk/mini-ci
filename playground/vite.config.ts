import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import { uniMiniCI } from "vite-plugin-uni-mini-ci";

import { config } from "./config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
    uniMiniCI({
      "mp-weixin": {
        appid: config["mp-weixin"].appid,
        privateKeyPath: config["mp-weixin"].privateKeyPath,
      },
    }),
  ],
});
