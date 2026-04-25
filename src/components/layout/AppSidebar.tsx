import { Fragment, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  BadgeCheck,
  ShieldCheck,
  UserCog,
  FileBarChart,
  ScrollText,
  ChevronDown,
  Briefcase,
  ListChecks,
  FileText,
  Wallet,
  ListTodo,
  MessageSquare,
  Inbox,
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
import { usePermissions } from "@/hooks/usePermissions";
import type { AppRole } from "@/lib/constants";

interface Item {
  title: string;
  url: string;
  icon: typeof Users;
  roles?: AppRole[];
  perm?: { module: string; action: "read" | "create" | "update" | "delete" };
}

const itemsOperatoria: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mis turnos de hoy", url: "/mis-turnos", icon: ListTodo },
  { title: "Pacientes", url: "/pacientes", icon: Users },
  { title: "Atenciones", url: "/atenciones", icon: ClipboardList },
  { title: "Profesionales", url: "/profesionales", icon: Stethoscope, roles: ["admin"] },
  { title: "Obras sociales", url: "/obras-sociales", icon: BadgeCheck, roles: ["admin", "recepcion"] },
];

const itemsTurnos: Item[] = [
  { title: "Agenda", url: "/turnos", icon: CalendarDays, perm: { module: "agenda", action: "read" } },
  { title: "Turnos solicitados", url: "/turnos/solicitudes", icon: Inbox, roles: ["admin", "recepcion"] },
  { title: "Bloqueos de agenda", url: "/bloqueos", icon: CalendarOff, perm: { module: "bloqueos_agenda", action: "read" } },
];

const itemsGestion: Item[] = [
  { title: "Prestaciones", url: "/prestaciones", icon: ListChecks, roles: ["admin", "recepcion"] },
  { title: "Presupuestos", url: "/presupuestos", icon: FileText, roles: ["admin", "recepcion"] },
  { title: "Cobros", url: "/cobros", icon: Wallet, roles: ["admin", "recepcion"] },
];

const itemsSeguridad: Item[] = [
  { title: "Usuarios", url: "/seguridad/usuarios", icon: Users, roles: ["admin"] },
  { title: "Perfiles", url: "/seguridad/perfiles", icon: UserCog, roles: ["admin"] },
  { title: "Mi perfil", url: "/seguridad/mi-perfil", icon: UserCog },
  { title: "Reportes de seguridad", url: "/seguridad/reportes", icon: FileBarChart, roles: ["admin"] },
  { title: "Auditoría de seguridad", url: "/seguridad/auditoria", icon: ScrollText, roles: ["admin"] },
  { title: "Prueba Twilio", url: "/seguridad/twilio-test", icon: MessageSquare, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { roles } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();

  const canSee = (i: Item) => {
    if (i.roles && !i.roles.some((r) => roles.includes(r))) return false;
    if (i.perm && !can(i.perm.module, i.perm.action)) return false;
    return true;
  };
  const visibleOp = itemsOperatoria.filter(canSee);
  const visibleTur = itemsTurnos.filter(canSee);
  const visibleGes = itemsGestion.filter(canSee);
  const visibleSeg = itemsSeguridad.filter(canSee);

  const segActive = location.pathname.startsWith("/seguridad") || location.pathname === "/usuarios";
  const [segOpen, setSegOpen] = useState(segActive);
  const gesActive = ["/prestaciones", "/presupuestos", "/cobros"].some((p) => location.pathname.startsWith(p));
  const [gesOpen, setGesOpen] = useState(gesActive);
  const turActive = ["/turnos", "/bloqueos"].some((p) => location.pathname.startsWith(p));
  const [turOpen, setTurOpen] = useState(turActive);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
            <span className="font-semibold text-base leading-none">O</span>
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 text-[10px] leading-none font-semibold"
            >
              +
            </span>
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
                <Fragment key={item.title}>
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {item.url === "/dashboard" && visibleTur.length > 0 && (
                    <Collapsible key="turnos-group" open={collapsed ? true : turOpen} onOpenChange={setTurOpen}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent/50">
                            <CalendarDays className="h-4 w-4" />
                            {!collapsed && (
                              <>
                                <span className="flex-1 text-left">Turnos</span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${turOpen ? "rotate-180" : ""}`} />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {visibleTur.map((sub) => (
                              <SidebarMenuSubItem key={sub.title}>
                                <SidebarMenuSubButton asChild>
                                  <NavLink
                                    to={sub.url}
                                    end
                                    className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                                  >
                                    <sub.icon className="h-4 w-4" />
                                    {!collapsed && <span>{sub.title}</span>}
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )}
                </Fragment>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleGes.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestión</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible open={collapsed ? true : gesOpen} onOpenChange={setGesOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent/50">
                        <Briefcase className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">Gestión</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${gesOpen ? "rotate-180" : ""}`} />
                          </>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {visibleGes.map((item) => (
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
