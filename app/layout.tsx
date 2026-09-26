import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/app/_components/theme-toggle";

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
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* 首帧前根据 localStorage / 系统偏好设置 .dark,避免主题闪烁。
            见 lib/settings/theme.ts —— 与这里的 STORAGE_KEY 保持一致。 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('fedrill:theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()",
          }}
        />
        {/* Monaco 主脚本 preload · 与 HTML 并行下载,省 200-400ms 首屏
            见 lib/monaco/init.ts · public/monaco/ 由 postinstall 生成 */}
        <link rel="preload" href="/monaco/vs/loader.js" as="script" />
        <link rel="preload" href="/monaco/vs/editor/editor.main.js" as="script" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
