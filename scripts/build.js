/**
 * Quiz Buddy - Single File HTML Bundler
 * Compiles modular src/ files into a standalone dist/index.html single-file bundle.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

console.log('🚀 Bundling Quiz Buddy single-page app...');

try {
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }

  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(SRC, 'css', 'styles.css'), 'utf8');

  // Inline CSS
  html = html.replace(
    '<link rel="stylesheet" href="css/styles.css">',
    `<style>\n${css}\n</style>`
  );

  // Read and combine JS files
  const jsFiles = ['audio.js', 'wakelock.js', 'drag.js', 'app.js', 'buzzer.js'];
  let combinedJs = '';

  jsFiles.forEach(file => {
    const content = fs.readFileSync(path.join(SRC, 'js', file), 'utf8');
    combinedJs += `\n/* --- ${file} --- */\n${content}\n`;
    html = html.replace(new RegExp(`<script src="js/${file}"><\\/script>\\s*`, 'g'), '');
  });

  // Inject bundled JS before </body>
  html = html.replace('</body>', `<script>\n${combinedJs}\n</script>\n</body>`);

  const outputPath = path.join(DIST, 'index.html');
  fs.writeFileSync(outputPath, html, 'utf8');

  const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(2);
  console.log(`✅ Success! Created single-file bundle: dist/index.html (${sizeKb} KB)`);
} catch (err) {
  console.error('❌ Build failed:', err);
  process.exit(1);
}
