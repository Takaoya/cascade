'use client'

import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'

interface ShareButtonProps {
  targetId: string // DOM id of the element to screenshot
  tweetText?: string
}

export function ShareButton({ targetId, tweetText }: ShareButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleShare = async () => {
    setLoading(true)
    try {
      const el = document.getElementById(targetId)
      if (!el) return

      const canvas = await html2canvas(el, { backgroundColor: '#09090b', scale: 2 })
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      )

      // Try native share sheet (mobile)
      if (navigator.share && navigator.canShare({ files: [new File([blob], 'cascade.png')] })) {
        await navigator.share({
          files: [new File([blob], 'cascade.png', { type: 'image/png' })],
          text: tweetText,
        })
      } else {
        // Desktop fallback: download + open Twitter intent
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'cascade-scenario.png'
        a.click()
        URL.revokeObjectURL(url)

        if (tweetText) {
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
          window.open(twitterUrl, '_blank')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-100 rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      )}
      {loading ? 'Capturing...' : 'Share'}
    </button>
  )
}
