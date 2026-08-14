import Link from "next/link";
import { adminLogout } from "@/app/admin/actions";

/** Chrome for the pages behind the password. The login page sits outside this group. */
export default function SignedInAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 rounded-lg bg-section px-3 py-2">
        <Link
          href="/admin"
          className="font-cond text-sm font-semibold uppercase tracking-widest text-text-muted"
        >
          Admin only
        </Link>
        <span className="flex-1" />
        <form action={adminLogout}>
          <button
            type="submit"
            className="font-cond text-sm font-semibold uppercase tracking-wide text-teal"
          >
            Sign out
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
