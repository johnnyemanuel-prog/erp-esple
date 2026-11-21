import type { NextConfig } from "next";

/** Versão do app: muda a cada publicação e faz o service worker baixar as telas novas. */
const versao = (process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`).slice(0, 12);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: { NEXT_PUBLIC_VERSAO: versao },
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};

export default nextConfig;
