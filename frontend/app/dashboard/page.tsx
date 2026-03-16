"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getMe, type User } from "@/lib/api";
import { clearAuthSession, getStoredUser, getToken } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = getToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    getMe(token)
      .then((responseUser) => {
        if (!active) {
          return;
        }
        setUser(responseUser);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        clearAuthSession();
        router.replace("/login");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  const joinedOn = useMemo(() => {
    if (!user?.created_at) {
      return "";
    }

    return new Date(user.created_at).toLocaleString();
  }, [user?.created_at]);

  function handleLogout() {
    clearAuthSession();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="cg-shell flex items-center justify-center">
        <p className="text-sm text-neutral-700">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="cg-shell">
      <section className="cg-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="mt-1 text-sm text-neutral-700">Authenticated shell ready for Phase 0 data features.</p>
          </div>
          <button
            className="rounded-xl border border-black/20 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-black/5"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-black/10 bg-white/70 p-5">
            <p className="text-xs uppercase tracking-wider text-neutral-600">Logged in as</p>
            <p className="mt-2 text-lg font-semibold">{user?.email}</p>
            <p className="mt-1 text-sm text-neutral-700">Joined: {joinedOn}</p>
          </article>

          <article className="rounded-2xl border border-black/10 bg-white/70 p-5">
            <p className="text-xs uppercase tracking-wider text-neutral-600">Next Step</p>
            <p className="mt-2 text-sm text-neutral-800">
              Post upload and listing will be added in the next implementation step.
            </p>
            <Link href="/" className="mt-3 inline-block text-sm font-semibold text-teal-800">
              Back to home
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
