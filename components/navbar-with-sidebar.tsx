import Logo from './logo'
import { Avatar, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DiscordLogoIcon,
  GitHubLogoIcon,
  TwitterLogoIcon,
} from '@radix-ui/react-icons'
import { Session } from '@supabase/supabase-js'
import { ArrowRight, LogOut, Trash, Undo, Menu } from 'lucide-react'
import Link from 'next/link'

export function NavBar({
  session,
  showLogin,
  signOut,
  onClear,
  canClear,
  onSocialClick,
  onUndo,
  canUndo,
  onToggleSidebar,
}: {
  session: Session | null
  showLogin: () => void
  signOut: () => void
  onClear: () => void
  canClear: boolean
  onSocialClick: (target: 'github' | 'x' | 'discord') => void
  onUndo: () => void
  canUndo: boolean
  onToggleSidebar?: () => void
}) {
  return (
    <nav className="w-full flex bg-background py-4">
      <div className="flex flex-1 items-center">
        {onToggleSidebar && (
          <Button
            onClick={onToggleSidebar}
            variant="ghost"
            size="icon"
            className="mr-2 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <Link href="/" className="flex items-center gap-2" target="_blank">
          <Logo width={24} height={24} />
          <h1 className="text-xl font-semibold">apps by ben</h1>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onUndo}
                disabled={!canUndo}
                size="icon"
                variant="ghost"
              >
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onClear}
                disabled={!canClear}
                size="icon"
                variant="ghost"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear chat</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button size="icon" variant="ghost">
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={
                    session?.user?.user_metadata?.avatar_url ||
                    session?.user?.user_metadata?.user_name ||
                    'https://github.com/ghost.png'
                  }
                  alt={
                    session?.user?.user_metadata?.name ||
                    session?.user?.user_metadata?.user_name ||
                    'User'
                  }
                />
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm font-medium">
                {session?.user?.user_metadata?.name ||
                  session?.user?.user_metadata?.user_name ||
                  'Guest'}
              </span>
              <span className="text-xs text-muted-foreground">
                {session?.user?.email || 'Not signed in'}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {session?.user ? (
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={showLogin}>
                <ArrowRight className="mr-2 h-4 w-4" />
                <span>Sign in</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                window
                  .open('https://github.com/bentossell/fragg', '_blank')
                  ?.focus()
                onSocialClick('github')
              }}
            >
              <GitHubLogoIcon className="mr-2 h-4 w-4" />
              <span>GitHub</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                window.open('https://discord.gg/U7KEcGErtQ', '_blank')?.focus()
                onSocialClick('discord')
              }}
            >
              <DiscordLogoIcon className="mr-2 h-4 w-4" />
              <span>Discord</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                window.open('https://x.com/fragg_app', '_blank')?.focus()
                onSocialClick('x')
              }}
            >
              <TwitterLogoIcon className="mr-2 h-4 w-4" />
              <span>X</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}