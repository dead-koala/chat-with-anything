"use server";
import { TypeDatabase, TypeUser } from "@/types/TypeSupabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const supabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<TypeDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};

export const getUserDetails = async (): Promise<TypeUser | null> => {
  const supabase = await supabaseServerClient();

  const { data: user } = await supabase.from("users").select().single();

  return user;
};
