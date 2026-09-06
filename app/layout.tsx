import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FEDrill · 前端手撕题 AI 教练",
  description: "AI 面试官式阶梯追问 · 手写 Agent Loop + Web Worker 沙盒 · 零信任 BYOK",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Monaco 主脚本 preload · 与 HTML 并行下载,省 200-400ms 首屏
            见 lib/monaco/init.ts · public/monaco/ 由 postinstall 生成 */}
        <link rel="preload" href="/monaco/vs/loader.js" as="script" />
        <link rel="preload" href="/monaco/vs/editor/editor.main.js" as="script" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
