import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, MessageCircle, NotebookPen, Scale } from "lucide-react";

const ACTIONS = [
  {
    href: "/scan",
    label: "Scan food",
    icon: Camera,
    accent: true,
  },
  {
    href: "/diary",
    label: "Add meal",
    icon: NotebookPen,
    accent: false,
  },
  {
    href: "/assistant",
    label: "AI Coach",
    icon: MessageCircle,
    accent: false,
  },
  {
    href: "/progress",
    label: "Log weight",
    icon: Scale,
    accent: false,
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.href} href={action.href}>
            <Card
              className={
                action.accent
                  ? "border-primary/40 bg-primary/10 transition-colors hover:border-primary/70"
                  : "transition-colors hover:border-border/80 hover:bg-secondary/60"
              }
            >
              <CardContent className="flex flex-col items-center gap-2 py-4">
                <Icon
                  className={`size-5 ${action.accent ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="text-xs font-medium">{action.label}</span>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
