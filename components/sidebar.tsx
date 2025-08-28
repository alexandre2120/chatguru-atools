"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarItems = [
  {
    icon: MessageSquarePlus,
    href: "/tools/add-chats",
    title: "Add/Import Chats",
    active: true,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 h-full">
      <div className="flex flex-col items-center space-y-4 flex-1">
        <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
          <span className="text-white font-bold text-[8px] leading-tight text-center">Chat<br/>Guru</span>
        </div>
        
        {sidebarItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.active && pathname?.startsWith(item.href);
          
          return (
            <div key={index} className="relative group">
              <Link
                href={item.href}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  isActive
                    ? "bg-black text-white"
                    : "bg-white text-black hover:bg-gray-100 border border-gray-300"
                )}
                aria-label={item.title}
              >
                <Icon size={20} />
              </Link>
              
              <div className="absolute left-full ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {item.title}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-auto pt-4 border-t border-gray-200">
        <a 
          href="https://chatguru.com.br" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors writing-mode-vertical-rl transform rotate-180"
        >
          Developed by ChatGuru
        </a>
      </div>
    </div>
  );
}