"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { ApiError, signup } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await signup(email, password);
      setAuthSession(response.access_token, response.user);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError("Unable to create account right now");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="cg-shell flex items-center justify-center">
      <section className="cg-card w-full max-w-md">
        <h1 className="text-3xl font-semibold">Create Account</h1>
        <p className="mt-2 text-sm text-neutral-700">
          Start your Creator Growth workspace with email and password.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              className="cg-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              className="cg-input"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button className="cg-button w-full" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-sm text-neutral-700">
          Already have an account? <Link className="font-semibold text-teal-800" href="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
