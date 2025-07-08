// Deployment dialog for frontend-only apps (Vercel, Netlify, GitHub Pages, …)
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExternalLink } from 'lucide-react'

export function DeployDialog({
  url,
  sbxId,
  teamID,
  accessToken,
}: {
  url: string
  sbxId: string
  teamID: string | undefined
  accessToken: string | undefined
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default">
          Deploy
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="p-4 w-64 flex flex-col gap-3">
        <div className="text-sm font-semibold">Deploy your app</div>
        <a
          href="https://vercel.com/import"
          target="_blank"
          className="flex items-center gap-2 text-sm hover:underline"
        >
          <ExternalLink className="h-4 w-4" /> Deploy to Vercel
        </a>
        <a
          href="https://app.netlify.com/drop"
          target="_blank"
          className="flex items-center gap-2 text-sm hover:underline"
        >
          <ExternalLink className="h-4 w-4" /> Deploy to Netlify
        </a>
        <a
          href="https://pages.github.com/"
          target="_blank"
          className="flex items-center gap-2 text-sm hover:underline"
        >
          <ExternalLink className="h-4 w-4" /> GitHub Pages
        </a>
        <div className="text-xs text-muted-foreground pt-2">
          These platforms host static or JAMstack sites—perfect matches for
          Fragg’s frontend-only previews.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
