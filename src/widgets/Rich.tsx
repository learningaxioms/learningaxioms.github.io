import katex from 'katex'
import { useMemo } from 'react'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const cache = new Map<string, string>()
export function tex(src: string, display = false) {
  const k = (display ? 'D' : 'I') + src
  let html = cache.get(k)
  if (html === undefined) {
    try {
      html = katex.renderToString(src, { displayMode: display, throwOnError: false, strict: false })
    } catch {
      html = esc(src)
    }
    cache.set(k, html)
  }
  return html
}

/** Turn "Find $x$ when **y = 2**" into HTML. `\$` is a literal dollar sign. */
export function richHtml(text: string): string {
  const out: string[] = []
  const src = text.replace(/\\\$/g, '\u0000')
  const re = /\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let last = 0
  let m: RegExpExecArray | null
  const plain = (s: string) =>
    esc(s.replace(/\u0000/g, '$'))
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<mark>$1</mark>')
      .replace(/\n/g, '<br/>')
  while ((m = re.exec(src))) {
    out.push(plain(src.slice(last, m.index)))
    out.push(m[1] !== undefined ? tex(m[1].replace(/\u0000/g, '\\$'), true) : tex(m[2].replace(/\u0000/g, '\\$')))
    last = re.lastIndex
  }
  out.push(plain(src.slice(last)))
  return out.join('')
}

export function Rich({ text, as: Tag = 'span', className }: { text: string; as?: 'span' | 'div' | 'p'; className?: string }) {
  const html = useMemo(() => richHtml(text), [text])
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export function Tex({ src, display = false, className }: { src: string; display?: boolean; className?: string }) {
  const html = useMemo(() => tex(src, display), [src, display])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
