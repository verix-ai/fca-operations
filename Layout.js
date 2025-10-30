import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, Plus, BarChart3, Heart } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Operation Board",
    url: createPageUrl("Dashboard"),
    icon: BarChart3,
  },
  {
    title: "New Client Intake",
    url: createPageUrl("ClientIntake"),
    icon: Plus,
  },
  {
    title: "All Clients",
    url: createPageUrl("ClientList"),
    icon: Users,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-slate-900">
        <Sidebar className="border-r border-slate-700/50 bg-slate-800 shadow-2xl">
          <SidebarHeader className="border-b border-slate-700/50 p-6 bg-slate-800">
            <div className="flex items-center gap-3">
              {/* FCA Logo */}
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-2xl flex items-center justify-center shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-green-500"></div>
                <Heart className="w-6 h-6 text-white relative z-10" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">FCA Operations</h2>
                <p className="text-xs text-slate-400">Friendly Care Agency</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4 bg-slate-800">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 mb-2">
                Management
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-slate-700/80 transition-all duration-300 rounded-xl mb-2 border border-slate-700/50 ${
                          location.pathname === item.url 
                            ? 'bg-gradient-to-r from-blue-500/20 to-green-500/20 text-white shadow-lg border-blue-400/30' 
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-700/50 p-4 bg-slate-800">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                <span className="text-slate-300 font-semibold text-sm">FC</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">FCA Team</p>
                <p className="text-xs text-slate-400 truncate">Managing client care</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col bg-slate-900">
          {/* Mobile header */}
          <header className="bg-slate-800 border-b border-slate-700/50 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-700/50 p-2 rounded-lg transition-colors duration-200 text-white" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-bold text-white">FCA Operations</h1>
              </div>
            </div>
          </header>

          {/* Main content area */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}