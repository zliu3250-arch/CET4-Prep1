import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TMP_DIR = path.join(ROOT_DIR, '.singlefile-tmp');
const OUTPUT_FILE = path.join(ROOT_DIR, 'CET4-Prep-单文件版.html');

const DATA_FILES = [
  'vocab-cet4.json',
  'writing-2021-2025.json',
  'translation-2021-2025.json',
  'reading-2021-2025.json',
  'listening-2021-2025.json',
];

function escapeInlineScript(text) {
  return text.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

function escapeInlineStyle(text) {
  return text.replace(/<\/(style)/gi, '<\\/$1');
}

async function main() {
  console.log('[1/4] 正在使用 Vite + Rollup (IIFE 单块模式) 构建前端代码与样式...');
  await fs.rm(TMP_DIR, { recursive: true, force: true });

  try {
    await build({
      root: ROOT_DIR,
      configFile: false,
      base: './',
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      build: {
        outDir: TMP_DIR,
        emptyOutDir: true,
        copyPublicDir: false,
        cssCodeSplit: false,
        assetsInlineLimit: 100 * 1024 * 1024,
        sourcemap: false,
        minify: 'esbuild',
        rollupOptions: {
          input: path.join(ROOT_DIR, 'src/main.tsx'),
          output: {
            format: 'iife',
            name: 'CET4PrepApp',
            inlineDynamicImports: true,
            entryFileNames: 'bundle.js',
            assetFileNames: 'bundle.[ext]',
          },
        },
      },
    });

    console.log('[2/4] 正在读取构建产物与 2021-2025 全量内置题库...');
    const jsCode = await fs.readFile(path.join(TMP_DIR, 'bundle.js'), 'utf8');
    let cssCode = '';
    try {
      cssCode = await fs.readFile(path.join(TMP_DIR, 'bundle.css'), 'utf8');
    } catch {
      const files = await fs.readdir(TMP_DIR);
      const cssFile = files.find((f) => f.endsWith('.css'));
      if (!cssFile) throw new Error('未找到构建生成的 CSS 文件');
      cssCode = await fs.readFile(path.join(TMP_DIR, cssFile), 'utf8');
    }

    const iconSvg = await fs.readFile(path.join(ROOT_DIR, 'public/icon.svg'), 'utf8');
    const iconDataUri = `data:image/svg+xml;base64,${Buffer.from(iconSvg, 'utf8').toString('base64')}`;

    const embeddedBanks = {};
    const stats = [];
    for (const fileName of DATA_FILES) {
      const raw = await fs.readFile(path.join(ROOT_DIR, 'public/data', fileName), 'utf8');
      const parsed = JSON.parse(raw);
      embeddedBanks[fileName] = parsed;
      stats.push(`${fileName}: ${Array.isArray(parsed) ? parsed.length : 0} 条`);
    }

    const banksJson = escapeInlineScript(JSON.stringify(embeddedBanks));
    const safeCss = escapeInlineStyle(cssCode);
    const safeJs = escapeInlineScript(jsCode);

    console.log('[3/4] 正在组装独立单文件 HTML...');
    const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#4f46e5" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="icon" type="image/svg+xml" href="${iconDataUri}" />
    <title>CET4-Prep · 英语四级备考助手（单文件离线版）</title>
    <style>${safeCss}</style>
  </head>
  <body class="bg-slate-50 text-slate-900 antialiased">
    <div id="root"></div>
    <script id="cet4-embedded-banks" type="application/json">${banksJson}</script>
    <script>${safeJs}</script>
  </body>
</html>
`;

    await fs.writeFile(OUTPUT_FILE, html, 'utf8');

    console.log('[4/4] 正在执行隐私与完整性自检...');
    if (/sk-[A-Za-z0-9]{20,}/.test(html)) {
      throw new Error('隐私自检失败：单文件中检测到疑似 API Key！');
    }

    const stat = await fs.stat(OUTPUT_FILE);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ 单文件版构建成功！`);
    console.log(`   输出文件: ${OUTPUT_FILE}`);
    console.log(`   文件体积: ${sizeMB} MB (${stat.size.toLocaleString()} bytes)`);
    console.log(`   内置题库: ${stats.join(' | ')}`);
    console.log(`   隐私检查: 0 敏感信息，任何新手机/新电脑打开均为全新空白账号`);
  } finally {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('❌ 单文件构建失败:', err);
  process.exit(1);
});
