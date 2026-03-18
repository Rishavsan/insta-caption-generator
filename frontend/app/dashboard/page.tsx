"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  createPost,
  deletePost,
  getMe,
  listPosts,
  searchSongs,
  type Post,
  type SongMetadata,
  type UpdatePostInput,
  type User,
  updatePost,
} from "@/lib/api";
import { clearAuthSession, getStoredUser, getToken } from "@/lib/auth";

function songLabel(song: SongMetadata): string {
  const artists = song.artist_names.join(", ");
  return artists ? `${song.song_name} - ${artists}` : song.song_name;
}

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
  const [songQuery, setSongQuery] = useState("");
  const [songResults, setSongResults] = useState<SongMetadata[]>([]);
  const [selectedSong, setSelectedSong] = useState<SongMetadata | null>(null);
  const [songSearchLoading, setSongSearchLoading] = useState(false);
  const [songSearchError, setSongSearchError] = useState("");
  const [showSongDropdown, setShowSongDropdown] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editPostId, setEditPostId] = useState<number | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editSongQuery, setEditSongQuery] = useState("");
  const [editSongResults, setEditSongResults] = useState<SongMetadata[]>([]);
  const [editSelectedSong, setEditSelectedSong] = useState<SongMetadata | null>(null);
  const [editSongSearchLoading, setEditSongSearchLoading] = useState(false);
  const [editSongSearchError, setEditSongSearchError] = useState("");
  const [showEditSongDropdown, setShowEditSongDropdown] = useState(false);
  const [editSongTouched, setEditSongTouched] = useState(false);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPostIds, setDeletingPostIds] = useState<Record<number, boolean>>({});

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

  useEffect(() => {
    if (!composerOpen) {
      return;
    }

    const token = getToken();
    const cleanedQuery = songQuery.trim();

    if (!cleanedQuery) {
      setSongResults([]);
      setSongSearchError("");
      setSongSearchLoading(false);
      return;
    }

    if (selectedSong && cleanedQuery === songLabel(selectedSong)) {
      setSongResults([]);
      setSongSearchError("");
      setSongSearchLoading(false);
      return;
    }

    if (!token) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    let active = true;
    setSongSearchLoading(true);

    const timeoutId = window.setTimeout(() => {
      searchSongs(token, cleanedQuery)
        .then((results) => {
          if (!active) {
            return;
          }

          setSongResults(results);
          setSongSearchError("");
          setShowSongDropdown(true);
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

          const message = error instanceof ApiError ? error.detail : "Song search failed. Please try again.";
          setSongSearchError(message);
          setSongResults([]);
          setShowSongDropdown(true);
        })
        .finally(() => {
          if (active) {
            setSongSearchLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [composerOpen, router, songQuery]);

  useEffect(() => {
    if (!editPostId) {
      return;
    }

    const token = getToken();
    const cleanedQuery = editSongQuery.trim();

    if (!cleanedQuery) {
      setEditSongResults([]);
      setEditSongSearchError("");
      setEditSongSearchLoading(false);
      return;
    }

    if (editSelectedSong && cleanedQuery === songLabel(editSelectedSong)) {
      setEditSongResults([]);
      setEditSongSearchError("");
      setEditSongSearchLoading(false);
      return;
    }

    if (!token) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    let active = true;
    setEditSongSearchLoading(true);

    const timeoutId = window.setTimeout(() => {
      searchSongs(token, cleanedQuery)
        .then((results) => {
          if (!active) {
            return;
          }

          setEditSongResults(results);
          setEditSongSearchError("");
          setShowEditSongDropdown(true);
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

          const message = error instanceof ApiError ? error.detail : "Song search failed. Please try again.";
          setEditSongSearchError(message);
          setEditSongResults([]);
          setShowEditSongDropdown(true);
        })
        .finally(() => {
          if (active) {
            setEditSongSearchLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [editPostId, editSelectedSong, editSongQuery, router]);

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
    setSongQuery("");
    setSongResults([]);
    setSelectedSong(null);
    setSongSearchLoading(false);
    setSongSearchError("");
    setShowSongDropdown(false);
    setSubmitError("");
  }

  function startEditingPost(post: Post) {
    setEditPostId(post.id);
    setEditCaption(post.caption ?? "");
    setEditSelectedSong(post.music_metadata ?? null);
    setEditSongQuery(post.music_metadata ? songLabel(post.music_metadata) : "");
    setEditSongResults([]);
    setEditSongSearchLoading(false);
    setEditSongSearchError("");
    setShowEditSongDropdown(false);
    setEditSongTouched(false);
    setEditError("");
  }

  function cancelEditingPost() {
    setEditPostId(null);
    setEditCaption("");
    setEditSongQuery("");
    setEditSongResults([]);
    setEditSelectedSong(null);
    setEditSongSearchLoading(false);
    setEditSongSearchError("");
    setShowEditSongDropdown(false);
    setEditSongTouched(false);
    setEditError("");
    setSavingEdit(false);
  }

  function closeComposer() {
    resetComposer();
    setComposerOpen(false);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setImageFile(nextFile);
  }

  function handleSongQueryChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSongQuery(value);
    setShowSongDropdown(true);
    setSongSearchError("");

    if (selectedSong && value.trim() !== songLabel(selectedSong)) {
      setSelectedSong(null);
    }
  }

  function handleSelectSong(song: SongMetadata) {
    setSelectedSong(song);
    setSongQuery(songLabel(song));
    setSongResults([]);
    setSongSearchError("");
    setShowSongDropdown(false);
  }

  function clearSelectedSong() {
    setSelectedSong(null);
    setSongQuery("");
    setSongResults([]);
    setSongSearchError("");
    setShowSongDropdown(false);
  }

  function handleEditSongQueryChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setEditSongQuery(value);
    setShowEditSongDropdown(true);
    setEditSongSearchError("");
    setEditSongTouched(true);

    if (editSelectedSong && value.trim() !== songLabel(editSelectedSong)) {
      setEditSelectedSong(null);
    }
  }

  function handleEditSelectSong(song: SongMetadata) {
    setEditSelectedSong(song);
    setEditSongQuery(songLabel(song));
    setEditSongResults([]);
    setEditSongSearchError("");
    setShowEditSongDropdown(false);
    setEditSongTouched(true);
  }

  function clearEditSelectedSong() {
    setEditSelectedSong(null);
    setEditSongQuery("");
    setEditSongResults([]);
    setEditSongSearchError("");
    setShowEditSongDropdown(false);
    setEditSongTouched(true);
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

    if (songQuery.trim() && !selectedSong) {
      setSubmitError("Select a song from the dropdown, or clear the song search field.");
      return;
    }

    setSubmitError("");
    setSubmitting(true);

    try {
      const selectedSongLabelText = selectedSong ? songLabel(selectedSong) : "";
      const createdPost = await createPost(token, {
        image: imageFile,
        caption,
        musicInfo: selectedSongLabelText,
        musicMetadata: selectedSong,
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

  async function handleSavePostEdit(postId: number) {
    const token = getToken();
    if (!token) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    if (editSongQuery.trim() && !editSelectedSong) {
      setEditError("Select a song from the dropdown, or clear the song search field.");
      return;
    }

    const payload: UpdatePostInput = {
      caption: editCaption,
    };

    if (editSongTouched) {
      payload.musicInfo = editSelectedSong ? songLabel(editSelectedSong) : null;
      payload.musicMetadata = editSelectedSong;
    }

    setEditError("");
    setSavingEdit(true);

    try {
      const updatedPost = await updatePost(token, postId, payload);
      setPosts((currentPosts) => currentPosts.map((post) => (post.id === postId ? updatedPost : post)));
      cancelEditingPost();
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          clearAuthSession();
          router.replace("/login");
          return;
        }

        setEditError(error.detail);
      } else {
        setEditError("Unable to update post right now.");
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeletePost(postId: number) {
    const confirmed = window.confirm("Delete this post? This action cannot be undone.");
    if (!confirmed) {
      return;
    }

    const token = getToken();
    if (!token) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    setDeletingPostIds((currentState) => ({ ...currentState, [postId]: true }));

    try {
      await deletePost(token, postId);
      setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));

      if (editPostId === postId) {
        cancelEditingPost();
      }
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          clearAuthSession();
          router.replace("/login");
          return;
        }

        setFeedError(error.detail);
      } else {
        setFeedError("Unable to delete the post right now.");
      }
    } finally {
      setDeletingPostIds((currentState) => {
        const nextState = { ...currentState };
        delete nextState[postId];
        return nextState;
      });
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
                  Song Search
                </label>

                <div className="relative">
                  <input
                    autoComplete="off"
                    className="cg-input"
                    id="music"
                    onChange={handleSongQueryChange}
                    onFocus={() => setShowSongDropdown(true)}
                    placeholder="Search song title..."
                    value={songQuery}
                  />

                  {showSongDropdown && songQuery.trim() ? (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-black/15 bg-white shadow-lg">
                      {songSearchLoading ? (
                        <p className="px-3 py-2 text-sm text-neutral-600">Searching songs...</p>
                      ) : null}

                      {!songSearchLoading && songSearchError ? (
                        <p className="px-3 py-2 text-sm text-red-700">{songSearchError}</p>
                      ) : null}

                      {!songSearchLoading && !songSearchError && songResults.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-neutral-600">No songs found.</p>
                      ) : null}

                      {!songSearchLoading && !songSearchError
                        ? songResults.map((song) => (
                            <button
                              className="block w-full border-b border-black/5 px-3 py-2 text-left transition last:border-b-0 hover:bg-black/5"
                              key={song.track_id}
                              onClick={() => handleSelectSong(song)}
                              type="button"
                            >
                              <p className="text-sm font-semibold text-neutral-900">{song.song_name}</p>
                              <p className="text-xs text-neutral-700">{song.artist_names.join(", ") || "Unknown artist"}</p>
                              {song.album_name ? <p className="text-xs text-neutral-500">Album: {song.album_name}</p> : null}
                            </button>
                          ))
                        : null}
                    </div>
                  ) : null}
                </div>

                {selectedSong ? (
                  <div className="rounded-xl border border-teal-700/25 bg-teal-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-900">Selected song</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-900">{selectedSong.song_name}</p>
                    <p className="text-xs text-neutral-700">{selectedSong.artist_names.join(", ") || "Unknown artist"}</p>
                    {selectedSong.album_name ? (
                      <p className="text-xs text-neutral-600">Album: {selectedSong.album_name}</p>
                    ) : null}
                    <button className="mt-2 text-xs font-semibold text-teal-800" onClick={clearSelectedSong} type="button">
                      Change song
                    </button>
                  </div>
                ) : null}

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
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{user?.email ?? "Creator"}</p>
                      <time className="text-xs text-neutral-600">{new Date(post.created_at).toLocaleDateString()}</time>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg border border-black/15 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-black/5"
                        disabled={savingEdit || Boolean(deletingPostIds[post.id])}
                        onClick={() => startEditingPost(post)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg border border-red-300/80 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                        disabled={Boolean(deletingPostIds[post.id])}
                        onClick={() => handleDeletePost(post.id)}
                        type="button"
                      >
                        {deletingPostIds[post.id] ? "Deleting..." : "Delete"}
                      </button>
                    </div>
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
                    {post.music_metadata ? (
                      <div className="rounded-xl bg-black/5 px-3 py-2 text-xs text-neutral-700">
                        <p className="font-semibold text-neutral-800">Song: {post.music_metadata.song_name}</p>
                        <p>{post.music_metadata.artist_names.join(", ") || "Unknown artist"}</p>
                        {post.music_metadata.album_name ? <p>Album: {post.music_metadata.album_name}</p> : null}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-neutral-700">
                        {post.music_info ? `Music: ${post.music_info}` : "Music: not added"}
                      </p>
                    )}

                    {editPostId === post.id ? (
                      <section className="rounded-2xl border border-black/10 bg-white/75 p-3">
                        <h3 className="text-sm font-semibold text-neutral-900">Edit Post</h3>

                        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-neutral-600" htmlFor={`edit-caption-${post.id}`}>
                          Caption
                        </label>
                        <textarea
                          className="cg-input mt-1 min-h-20 resize-y"
                          id={`edit-caption-${post.id}`}
                          maxLength={2200}
                          onChange={(event) => setEditCaption(event.target.value)}
                          placeholder="Update caption"
                          value={editCaption}
                        />

                        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-neutral-600" htmlFor={`edit-song-${post.id}`}>
                          Song Search
                        </label>

                        <div className="relative mt-1">
                          <input
                            autoComplete="off"
                            className="cg-input"
                            id={`edit-song-${post.id}`}
                            onChange={handleEditSongQueryChange}
                            onFocus={() => setShowEditSongDropdown(true)}
                            placeholder="Search song title..."
                            value={editSongQuery}
                          />

                          {showEditSongDropdown && editSongQuery.trim() ? (
                            <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-black/15 bg-white shadow-lg">
                              {editSongSearchLoading ? (
                                <p className="px-3 py-2 text-sm text-neutral-600">Searching songs...</p>
                              ) : null}

                              {!editSongSearchLoading && editSongSearchError ? (
                                <p className="px-3 py-2 text-sm text-red-700">{editSongSearchError}</p>
                              ) : null}

                              {!editSongSearchLoading && !editSongSearchError && editSongResults.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-neutral-600">No songs found.</p>
                              ) : null}

                              {!editSongSearchLoading && !editSongSearchError
                                ? editSongResults.map((song) => (
                                    <button
                                      className="block w-full border-b border-black/5 px-3 py-2 text-left transition last:border-b-0 hover:bg-black/5"
                                      key={song.track_id}
                                      onClick={() => handleEditSelectSong(song)}
                                      type="button"
                                    >
                                      <p className="text-sm font-semibold text-neutral-900">{song.song_name}</p>
                                      <p className="text-xs text-neutral-700">{song.artist_names.join(", ") || "Unknown artist"}</p>
                                      {song.album_name ? <p className="text-xs text-neutral-500">Album: {song.album_name}</p> : null}
                                    </button>
                                  ))
                                : null}
                            </div>
                          ) : null}
                        </div>

                        {editSelectedSong ? (
                          <div className="mt-2 rounded-xl border border-teal-700/25 bg-teal-50 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-teal-900">Selected song</p>
                            <p className="mt-1 text-sm font-semibold text-neutral-900">{editSelectedSong.song_name}</p>
                            <p className="text-xs text-neutral-700">{editSelectedSong.artist_names.join(", ") || "Unknown artist"}</p>
                            {editSelectedSong.album_name ? (
                              <p className="text-xs text-neutral-600">Album: {editSelectedSong.album_name}</p>
                            ) : null}
                            <button className="mt-2 text-xs font-semibold text-teal-800" onClick={clearEditSelectedSong} type="button">
                              Clear song
                            </button>
                          </div>
                        ) : null}

                        {editError ? <p className="mt-2 text-sm text-red-700">{editError}</p> : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="cg-button"
                            disabled={savingEdit}
                            onClick={() => handleSavePostEdit(post.id)}
                            type="button"
                          >
                            {savingEdit ? "Saving..." : "Save changes"}
                          </button>
                          <button
                            className="rounded-xl border border-black/20 px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-black/5"
                            disabled={savingEdit}
                            onClick={cancelEditingPost}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </section>
                    ) : null}
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
