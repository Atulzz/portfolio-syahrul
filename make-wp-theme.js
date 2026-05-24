import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const themeDir = 'portfolio-syahrul-theme';
const distDir = 'dist';

console.log('Building project using Vite...');
execSync('npm run build', { stdio: 'inherit' });

console.log(`Creating theme directory: ${themeDir}...`);
if (fs.existsSync(themeDir)) {
  fs.rmSync(themeDir, { recursive: true, force: true });
}
fs.mkdirSync(themeDir);
fs.mkdirSync(path.join(themeDir, 'assets'));

console.log('Writing style.css...');
const styleCssContent = `/*
Theme Name: Syahrul Ramadhany - Cinematic 3D Portfolio
Theme URI: https://github.com/Atulzz/portfolio-syahrul
Author: Syahrul Ramadhany
Description: Tema Portfolio 3D Cinematic Minimalist menggunakan Three.js dan Vite.
Version: 1.0.0
License: GNU General Public License v2 or later
Text Domain: portfolio-syahrul
*/`;
fs.writeFileSync(path.join(themeDir, 'style.css'), styleCssContent);

console.log('Processing index.html -> index.php...');
let indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

// Replace asset paths with WordPress PHP functions
indexHtml = indexHtml.replace(/src="\/portfolio-syahrul\/assets\//g, 'src="<?php echo get_template_directory_uri(); ?>/assets/');
indexHtml = indexHtml.replace(/href="\/portfolio-syahrul\/assets\//g, 'href="<?php echo get_template_directory_uri(); ?>/assets/');
indexHtml = indexHtml.replace(/src="\/assets\//g, 'src="<?php echo get_template_directory_uri(); ?>/assets/');
indexHtml = indexHtml.replace(/href="\/assets\//g, 'href="<?php echo get_template_directory_uri(); ?>/assets/');

fs.writeFileSync(path.join(themeDir, 'index.php'), indexHtml);

console.log('Copying assets...');
const distAssetsDir = path.join(distDir, 'assets');
const themeAssetsDir = path.join(themeDir, 'assets');

const files = fs.readdirSync(distAssetsDir);
for (const file of files) {
  fs.copyFileSync(path.join(distAssetsDir, file), path.join(themeAssetsDir, file));
}

console.log('Zipping theme folder using PowerShell...');
const zipFile = 'portfolio-syahrul-theme.zip';
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}
try {
  execSync(`powershell -Command "Compress-Archive -Path ${themeDir} -DestinationPath ${zipFile} -Force"`);
  console.log(`WordPress theme zip file created successfully: ${zipFile}`);
} catch (error) {
  console.error('Failed to zip theme folder:', error);
}
