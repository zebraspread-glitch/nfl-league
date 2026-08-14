import Link from "next/link";
import { Card, PageIntro } from "@/components/ui";

export const metadata = {
  title: "Admin - MGL Fantasy",
  robots: { index: false, follow: false },
};

const LINKS = [
  {
    href: "/admin/draft",
    title: "Draft Clock",
    detail: "Full-screen TV ticker for the live in-person draft.",
  },
];

export default function AdminHomePage() {
  return (
    <div>
      <PageIntro title="Admin" subtitle="Pages only you can see" />
      <Card>
        {LINKS.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block px-4 py-3 ${i % 2 === 0 ? "bg-row" : "bg-card"}`}
          >
            <div className="font-cond text-lg font-semibold">{link.title}</div>
            <div className="text-sm text-text-muted">{link.detail}</div>
          </Link>
        ))}
      </Card>
    </div>
  );
}
