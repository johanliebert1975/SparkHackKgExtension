#!/usr/bin/env node
/**
 * download-grammars.js
 *
 * Downloads Tree-sitter WASM grammar files from npm packages.
 * Run once: node scripts/download-grammars.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GRAMMARS_DIR = path.join(__dirname, '..', 'grammars');
fs.mkdirSync(GRAMMARS_DIR, { recursive: true });

const PACKAGES = [
  { pkg: 'tree-sitter-typescript',  file: 'tree-sitter-typescript/tree-sitter-typescript.wasm' },
  { pkg: 'tree-sitter-javascript',  file: 'tree-sitter-javascript.wasm' },
  { pkg: 'tree-sitter-python',      file: 'tree-sitter-python.wasm' },
  { pkg: 'tree-sitter-java',        file: 'tree-sitter-java.wasm' },
  { pkg: 'tree-sitter-go',          file: 'tree-sitter-go.wasm' },
  { pkg: 'tree-sitter-rust',        file: 'tree-sitter-rust.wasm' },
  { pkg: 'tree-sitter-cpp',         file: 'tree-sitter-cpp.wasm' },
];

console.log('Installing grammar packages temporarily...');

for (const { pkg, file } of PACKAGES) {
  try {
    console.log(`Fetching ${pkg}...`);
    const tmpDir = path.join(__dirname, '..', 'node_modules', pkg);

    // Package should already be installed if you ran npm install with the right packages
    // Try to find the wasm file
    const possiblePaths = [
      path.join(tmpDir, file),
      path.join(tmpDir, path.basename(file)),
      path.join(tmpDir, 'tree-sitter-' + pkg.replace('tree-sitter-', '') + '.wasm'),
    ];

    let found = false;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const dest = path.join(GRAMMARS_DIR, path.basename(p));
        fs.copyFileSync(p, dest);
        console.log(`  ✓ Copied to grammars/${path.basename(p)}`);
        found = true;
        break;
      }
    }

    if (!found) {
      console.warn(`  ⚠ Could not find WASM for ${pkg} — extension will use regex fallback for this language`);
    }
  } catch (err) {
    console.warn(`  ⚠ ${pkg}: ${err.message}`);
  }
}

console.log('\nDone. Grammar files are in ./grammars/');
console.log('Languages without WASM will use the regex fallback parser.');
