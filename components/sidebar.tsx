"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, FileSpreadsheet, Settings, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarItems = [
  {
    icon: MessageSquarePlus,
    href: "/tools/add-chats",
    title: "Add/Import Chats",
    active: true,
  },
  {
    icon: FileSpreadsheet,
    href: "#",
    title: "Placeholder 1",
    active: false,
  },
  {
    icon: Settings,
    href: "#",
    title: "Placeholder 2",
    active: false,
  },
  {
    icon: HelpCircle,
    href: "#",
    title: "Placeholder 3",
    active: false,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 space-y-4">
      <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center mb-4">
        <span className="text-white font-bold text-sm">CG</span>
      </div>
      
      {sidebarItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = item.active && pathname?.startsWith(item.href);
        
        return (
          <div key={index} className="relative group">
            {item.active ? (
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
            ) : (
              <button
                disabled
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-400 cursor-not-allowed"
                aria-label={item.title}
              >
                <Icon size={20} />
              </button>
            )}
            
            <div className="absolute left-full ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {item.title}
            </div>
          </div>
        );
      })}
    </div>
  );
}