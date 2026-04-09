import { NextResponse } from 'next/server'

interface Headline {
  title: string
  url: string
  source: string
  publishedAt: string
}

const RSS_SOURCES = [
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml' },
  { name: 'The Hill', url: 'https://thehill.com/rss/syndicator/19109/' },
  { name: 'NPR Politics', url: 'https://feeds.npr.org/1014/rss.xml' },
]

function parseRSS(xml: string, sourceName: string): Headline[] {
  const items: Headline[] = []

  // Extract <item> blocks
  const itemRegex = /<item[\s\S]*?<\/item>/gi
  const itemMatches = xml.match(itemRegex) ?? []

  for (const item of itemMatches) {
    // Extract title (handles CDATA and plain)
    const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
    const title = titleMatch?.[1]?.trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&quot;/g, '"')
    if (!title) continue

    // Extract link (handles CDATA, plain text, and <link> vs <link href="">)
    const linkMatch = item.match(/<link[^>]*>(?:<!\[CDATA\[)?(https?:\/\/[^\s<\]]+)(?:\]\]>)?<\/link>/)
      ?? item.match(/<link[^>]+href="(https?:\/\/[^"]+)"/)
    const url = linkMatch?.[1]?.trim()
    if (!url) continue

    // Extract pubDate
    const dateMatch = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)
    const pubDateStr = dateMatch?.[1]?.trim() ?? ''
    const publishedAt = pubDateStr ? new Date(pubDateStr).toISOString() : new Date().toISOString()

    items.push({ title, url, source: sourceName, publishedAt })
  }

  return items
}

export async function GET() {
  try {
    const results = await Promise.allSettled(
      RSS_SOURCES.map(async ({ name, url }) => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CascadeBot/1.0)' },
            next: { revalidate: 900 }, // cache 15 min
          })
          if (!res.ok) return []
          const xml = await res.text()
          return parseRSS(xml, name)
        } catch {
          return []
        } finally {
          clearTimeout(timeout)
        }
      })
    )

    const all: Headline[] = results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .filter(h => h.title.length > 10) // remove junk

    // Sort by most recent first
    all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    // Deduplicate by similar title
    const seen = new Set<string>()
    const deduped = all.filter(h => {
      const key = h.title.slice(0, 40).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({
      headlines: deduped.slice(0, 12),
      fetched_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[/api/news]', err)
    return NextResponse.json({ headlines: [], fetched_at: new Date().toISOString() }, { status: 500 })
  }
}
