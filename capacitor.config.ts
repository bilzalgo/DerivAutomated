import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gsquad.mobile",
  appName: "G-Squad",
  webDir: "dist/client",
  server: {
    androidScheme: "https",
  },
};

export default config;