import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarDays,
  ClipboardList,
  BadgeCheck,
  ShieldCheck,
  UserCog,
  FileBarChart,
  ScrollText,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/constants";

interface Item {
  title: string;
  url: string;
  icon: typeof Users;
  roles?: AppRole[];
}

const itemsOperatoria: Item[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Turnos", url: "/turnos", icon: CalendarDays },
  { title: "Pacientes", url: "/pacientes", icon: Users },
  { title: "Atenciones", url: "/atenciones", icon: ClipboardList },
  { title: "Profesionales", url: "/profesionales", icon: Stethoscope, roles: ["admin"] },
  { title: "Obras sociales", url: "/obras-sociales", icon: BadgeCheck, roles: ["admin", "recepcion"] },
];

const itemsSeguridad: Item[] = [
  { title: "Usuarios", url: "/seguridad/usuarios", icon: Users, roles: ["admin"] },
  { title: "Perfiles", url: "/seguridad/perfiles", icon: UserCog },
  { title: "Reportes de seguridad", url: "/seguridad/reportes", icon: FileBarChart, roles: ["admin"] },
  { title: "Auditoría de seguridad", url: "/seguridad/auditoria", icon: ScrollText, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { roles } = useAuth();
  const location = useLocation();

  const canSee = (i: Item) => !i.roles || i.roles.some((r) => roles.includes(r));
  const visibleOp = itemsOperatoria.filter(canSee);
  const visibleSeg = itemsSeguridad.filter(canSee);

  const segActive = location.pathname.startsWith("/seguridad") || location.pathname === "/usuarios";
  const [segOpen, setSegOpen] = useState(segActive);

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
              {visibleOp.map((item) => (
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

        {visibleSeg.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible open={collapsed ? true : segOpen} onOpenChange={setSegOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent/50"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">Seguridad</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${segOpen ? "rotate-180" : ""}`} />
                          </>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {!collapsed && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to="/seguridad"
                                end
                                className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                              >
                                <span>Resumen</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        {visibleSeg.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild>
                              <NavLink
                                to={item.url}
                                className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                              >
                                <item.icon className="h-4 w-4" />
                                {!collapsed && <span>{item.title}</span>}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
