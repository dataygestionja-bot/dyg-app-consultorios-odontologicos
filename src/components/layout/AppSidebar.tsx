import { LayoutDashboard, Users, Stethoscope, CalendarDays, ClipboardList, BadgeCheck, Shield } from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/constants";

interface Item {
  title: string;
  url: string;
  icon: typeof Users;
  roles?: AppRole[];
}

const items: Item[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Turnos", url: "/turnos", icon: CalendarDays },
  { title: "Pacientes", url: "/pacientes", icon: Users },
  { title: "Atenciones", url: "/atenciones", icon: ClipboardList },
  { title: "Profesionales", url: "/profesionales", icon: Stethoscope },
  { title: "Obras sociales", url: "/obras-sociales", icon: BadgeCheck, roles: ["admin", "recepcion"] },
  { title: "Usuarios", url: "/usuarios", icon: Shield, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { hasAnyRole, roles } = useAuth();

  const visible = items.filter((i) => !i.roles || i.roles.some((r) => roles.includes(r)) || hasAnyRole(["admin"]));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold">
            O
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground leading-tight">Consultorio</span>
              <span className="text-xs text-sidebar-foreground/60 leading-tight">Odontológico</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operatoria</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
