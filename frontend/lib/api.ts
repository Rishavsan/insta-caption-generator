export type User = {
  id: number;
  email: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type Post = {
  id: number;
  user_id: number;
  image_url: string;
  caption: string | null;
  music_info: string | null;
  created_at: string;
};

export type CreatePostInput = {
  image: File;
  caption: string;
  musicInfo: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set("Accept", "application/json");
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  if (init.body && !headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const detail = typeof payload?.detail === "string" ? payload.detail : "Unexpected API error";
    throw new ApiError(response.status, detail);
  }

  return payload as T;
}

export function signup(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(token: string): Promise<User> {
  return request<User>("/auth/me", { method: "GET" }, token);
}

export function listPosts(token: string): Promise<Post[]> {
  return request<Post[]>("/posts", { method: "GET" }, token);
}

export function createPost(token: string, input: CreatePostInput): Promise<Post> {
  const formData = new FormData();
  formData.set("image", input.image);

  const trimmedCaption = input.caption.trim();
  const trimmedMusicInfo = input.musicInfo.trim();

  if (trimmedCaption) {
    formData.set("caption", trimmedCaption);
  }

  if (trimmedMusicInfo) {
    formData.set("music_info", trimmedMusicInfo);
  }

  return request<Post>(
    "/posts",
    {
      method: "POST",
      body: formData,
    },
    token,
  );
}
