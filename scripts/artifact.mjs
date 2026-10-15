// Turn the single-file build (SINGLE=1 vite build) into an artifact page:
// no doctype/html/head/body wrappers, <title> first, script after the root element.
import { readFileSync, writeFileSync } from 'node:fs'
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const head = html.match(/<head>([\s\S]*)<\/head>/)[1]
const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
const take = (re) => (head.match(re) ?? []).join('\n')
const out = [
  '<title>AXIOM</title>',
  take(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g),
  take(/<style[\s\S]*?<\/style>/g),
  body.trim(),
  take(/<script[\s\S]*?<\/script>/g),
].join('\n')
writeFileSync(new URL('../dist/axiom.html', import.meta.url), out)
console.log('dist/axiom.html', (out.length / 1024).toFixed(0) + ' KB')
