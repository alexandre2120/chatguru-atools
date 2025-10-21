"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatGuruLogo } from "@/components/chatguru-logo";

const sidebarItems = [
  {
    icon: MessageSquarePlus,
    href: "/tools/add-chats",
    title: "Add/Import Chats",
  },
  {
    icon: Shield,
    href: "/admin",
    title: "Admin Panel",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-16 bg-card border-r border-border flex flex-col items-center py-4 h-full shadow-sm">
      <div className="flex flex-col items-center space-y-4 flex-1">
        <Link href="/" className="mb-4 hover:opacity-80 transition-opacity">
          <ChatGuruLogo iconOnly className="w-12 h-12" />
        </Link>
        
        {sidebarItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          
          return (
            <div key={index} className="relative group">
              <Link
                href={item.href}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:scale-105"
                )}
                aria-label={item.title}
              >
                <Icon size={20} />
              </Link>
              
              <div className="absolute left-full ml-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                {item.title}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-auto pt-4 border-t border-border">
        <a 
          href="https://chatguru.com.br" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors writing-mode-vertical-rl transform rotate-180"
        >
          Developed by ChatGuru
        </a>
      </div>
    </div>
  );
}