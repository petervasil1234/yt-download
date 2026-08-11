import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  busy: boolean
  disabled: boolean
  onSubmit: (url: string) => void
}

export function UrlBar({ busy, disabled, onSubmit }: Props) {
  const [url, setUrl] = useState('')

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = url.trim()
        if (trimmed !== '') onSubmit(trimmed)
      }}
    >
      <Input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Paste a YouTube link — a video, a playlist or a channel"
        disabled={disabled}
        aria-label="YouTube link"
        className="flex-1"
      />
      <Button type="submit" disabled={disabled || busy || url.trim() === ''}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="size-4" aria-hidden />
        )}
        Look up
      </Button>
    </form>
  )
}
