import { Card, PageIntro } from "@/components/ui";
import { AdminLoginForm } from "./login-form";

export const metadata = {
  title: "Admin - MGL Fantasy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div>
      <PageIntro title="Admin" subtitle="Private area - enter the code to continue" />
      <Card>
        <AdminLoginForm next={next ?? "/admin"} />
      </Card>
    </div>
  );
}
