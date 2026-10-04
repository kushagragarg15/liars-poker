import { build } from 'esbuild';
import fs from 'fs';
const r = await build({ entryPoints: ['src/app.jsx'], bundle: true, minify: true, format: 'iife', write: false, jsx: 'automatic', target: ['es2019'], define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/styles.css', 'utf8');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0F4D3B">
<title>Liar's Poker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,600;6..96,700;6..96,800&family=Figtree:wght@400;500;600;700;800&family=JetBrains+Mono:wght@700;800&display=swap">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<noscript>Liar's Poker needs JavaScript to run.</noscript>
<script>${js}</script>
</body>
</html>`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/liars-poker.html', html);
fs.writeFileSync('dist/index.html', html);
console.log('bytes', html.length);
