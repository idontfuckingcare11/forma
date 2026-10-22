import {
  Camera,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  NotebookPen,
  Settings,
  User,
  UtensilsCrossed,
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
  { href: "/places", label: "Nearby Dining", icon: UtensilsCrossed },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/assistant", label: "Assistant", icon: MessageCircle },
  { href: "/profile", label: "Profile & Settings", icon: Settings },
];

export const BOTTOM_NAV: NavItem[] = [
  MAIN_NAV[0], // /dashboard
  MAIN_NAV[3], // /places — Nearby Dining
  MAIN_NAV[2], // /scan — Camera, elevated center button
  MAIN_NAV[5], // /assistant — AI Assistant
  { href: "/profile", label: "Profile", icon: User },
];
