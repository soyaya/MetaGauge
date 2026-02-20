import type React from "react"
import { Bell } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface StartupHeaderProps {
  title: string
  subtitle: string
  action?: React.ReactNode
}

export function StartupHeader({ title, subtitle, action }: StartupHeaderProps) {
  return (
    <div className="flex items-center justify-between p-6 border-b">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        {action}
        <div className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
            2
          </span>
        </div>
        <Avatar>
          <AvatarImage src="/diverse-avatars.png" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      </div>
    </div>
  )
}
