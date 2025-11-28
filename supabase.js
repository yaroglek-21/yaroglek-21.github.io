import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://thbosfdjgdjcwmmkguln.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoYm9zZmRqZ2RqY3dtbWtndWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk4MTUsImV4cCI6MjA3OTM5NTgxNX0.TzoNQxqryYWG0Hvc1VczCzKIQLADRJhLfDmdNi5nEs4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile() {
  const session = await getSession();
  if (!session) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  return data;
}

export async function requireAuth() {
  const s = await getSession();
  if (!s) window.location.href = "./auth.html";
}
