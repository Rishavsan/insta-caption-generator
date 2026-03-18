"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";

import { ApiError, createPost, getMe, listPosts, type Post, type User } from "@/lib/api";
import { clearAuthSession, getStoredUser, getToken } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState("");

  const [composerOpen, setComposerOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [musicInfo, setMusicInfo] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const token = getToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    Promise.all([getMe(token), listPosts(token)])
      .then(([responseUser, responsePosts]) => {
        if (!active) {
          return;
        }
        setUser(responseUser);
        setPosts(responsePosts);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          clearAuthSession();
          router.replace("/login");
          return;
        }

        setFeedError("Unable to load your posts right now. Refresh and try again.");
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

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

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

  function openComposer() {
    setSubmitError("");
    setComposerOpen(true);
  }

  function resetComposer() {
    setImageFile(null);
    setCaption("");
    setMusicInfo("");
    setSubmitError("");
  }

  function closeComposer() {
    resetComposer();
    setComposerOpen(false);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setImageFile(nextFile);
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getToken();
    if (!token) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    if (!imageFile) {
      setSubmitError("Choose an image before posting.");
      return;
    }

    setSubmitError("");
    setSubmitting(true);

    try {
      const createdPost = await createPost(token, {
        image: imageFile,
        caption,
        musicInfo,
      });

      setPosts((currentPosts) => [createdPost, ...currentPosts]);
      closeComposer();
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          clearAuthSession();
          router.replace("/login");
          return;
        }

        setSubmitError(error.detail);
      } else {
        setSubmitError("Upload failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
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
            <p className="mt-1 text-sm text-neutral-700">Create and review your posts in one place.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Add post"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/15 bg-white/90 text-2xl leading-none text-neutral-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              onClick={openComposer}
              type="button"
            >
              +
            </button>
            <button
              className="rounded-xl border border-black/20 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-black/5"
              onClick={handleLogout}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>

        {feedError ? <p className="mt-4 text-sm text-red-700">{feedError}</p> : null}

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-black/10 bg-white/70 p-5">
            <p className="text-xs uppercase tracking-wider text-neutral-600">Logged in as</p>
            <p className="mt-2 text-lg font-semibold">{user?.email}</p>
            <p className="mt-1 text-sm text-neutral-700">Joined: {joinedOn}</p>
          </article>

          <article className="rounded-2xl border border-black/10 bg-white/70 p-5">
            <p className="text-xs uppercase tracking-wider text-neutral-600">Create</p>
            <p className="mt-2 text-sm text-neutral-800">
              Tap the + button to upload an image, write a caption, and attach music info.
            </p>
            <button className="mt-3 text-sm font-semibold text-teal-800" onClick={openComposer} type="button">
              Add your first post
            </button>
          </article>
        </div>

        {composerOpen ? (
          <section className="mt-8 rounded-2xl border border-black/10 bg-white/85 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Create Post</h2>
              <button
                className="rounded-lg border border-black/15 px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-black/5"
                onClick={closeComposer}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreatePost}>
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600" htmlFor="image">
                  Image
                </label>
                <input
                  accept="image/*"
                  className="cg-input"
                  id="image"
                  name="image"
                  onChange={handleImageChange}
                  required
                  type="file"
                />
                <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600" htmlFor="caption">
                  Caption
                </label>
                <textarea
                  className="cg-input min-h-24 resize-y"
                  id="caption"
                  maxLength={2200}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Share your post story..."
                  value={caption}
                />
                <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600" htmlFor="music">
                  Music Info
                </label>
                <input
                  className="cg-input"
                  id="music"
                  maxLength={255}
                  onChange={(event) => setMusicInfo(event.target.value)}
                  placeholder="Song title - artist"
                  value={musicInfo}
                />

                {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}

                <div className="flex flex-wrap gap-2">
                  <button className="cg-button" disabled={submitting} type="submit">
                    {submitting ? "Uploading..." : "Publish Post"}
                  </button>
                  <button
                    className="rounded-xl border border-black/20 px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-black/5"
                    disabled={submitting}
                    onClick={closeComposer}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <p className="mb-3 text-xs uppercase tracking-wide text-neutral-600">Preview</p>
                {imagePreview ? (
                  <img alt="Post preview" className="aspect-square w-full rounded-xl object-cover" src={imagePreview} />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-black/20 text-sm text-neutral-500">
                    Image preview appears here
                  </div>
                )}
              </div>
            </form>
          </section>
        ) : null}

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Your Posts</h2>
            <button className="text-sm font-semibold text-teal-800" onClick={openComposer} type="button">
              Add another post
            </button>
          </div>

          {posts.length === 0 ? (
            <article className="rounded-2xl border border-dashed border-black/20 bg-white/65 p-6 text-sm text-neutral-700">
              No posts yet. Upload your first image to build your dashboard feed.
            </article>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => (
                <article
                  className="overflow-hidden rounded-3xl border border-black/10 bg-white/90 shadow-lg shadow-black/5"
                  key={post.id}
                >
                  <header className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="text-sm font-semibold text-neutral-900">{user?.email ?? "Creator"}</p>
                    <time className="text-xs text-neutral-600">{new Date(post.created_at).toLocaleDateString()}</time>
                  </header>

                  <img
                    alt={post.caption ? post.caption.slice(0, 100) : "Uploaded post image"}
                    className="aspect-square w-full bg-neutral-100 object-cover"
                    src={post.image_url}
                  />

                  <div className="space-y-3 px-4 py-4">
                    <p className="text-sm leading-relaxed text-neutral-800">
                      {post.caption || "No caption added for this post yet."}
                    </p>
                    <p className="rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-neutral-700">
                      {post.music_info ? `Music: ${post.music_info}` : "Music: not added"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8">
          <Link href="/" className="text-sm font-semibold text-teal-800">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
