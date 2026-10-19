import {
  Camera,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  NotebookPen,
  Settings,
  User,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/diary", label: "Food Diary", icon: NotebookPen },
  { href: "/scan", label: "AI Analyzer", icon: Camera },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/assistant", label: "Assistant", icon: MessageCircle },
  { href: "/profile", label: "Profile & Settings", icon: Settings },
];

export const BOTTOM_NAV: NavItem[] = [
  MAIN_NAV[0],
  MAIN_NAV[1],
  MAIN_NAV[2],
  MAIN_NAV[4],
  { href: "/profile", label: "Profile", icon: User },
];
