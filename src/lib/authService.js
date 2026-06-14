function normalizeUsername(username = "") {
  return username.trim().toLowerCase().replace(/\s+/g, "_");
}

export function isValidUsername(username = "") {
  return /^[a-zA-Z0-9_.-]{3,18}$/.test(username.trim());
}

export function getUsernameError(username = "") {
  const trimmed = username.trim();

  if (!trimmed) return "Choose a username";
  if (trimmed.length < 3) return "Username must be at least 3 characters";
  if (trimmed.length > 18) return "Username must be 18 characters or less";
  if (!isValidUsername(trimmed)) {
    return "Use letters, numbers, dots, dashes or underscores";
  }

  return "";
}

export async function getCurrentSession(supabase) {
  if (!supabase?.auth) return { session: null, user: null, error: null };

  try {
    const { data, error } = await supabase.auth.getSession();
    return {
      session: data?.session || null,
      user: data?.session?.user || null,
      error,
    };
  } catch (error) {
    return { session: null, user: null, error };
  }
}

export async function signInWithEmail(supabase, { email, password }) {
  if (!supabase?.auth) {
    return { session: null, user: null, error: new Error("Auth is unavailable") };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  return {
    session: data?.session || null,
    user: data?.user || null,
    error,
  };
}

export async function signUpWithEmailUsername(
  supabase,
  { email, password, username }
) {
  if (!supabase?.auth) {
    return { session: null, user: null, error: new Error("Auth is unavailable") };
  }

  const usernameError = getUsernameError(username);
  if (usernameError) {
    return { session: null, user: null, error: new Error(usernameError) };
  }

  const cleanUsername = username.trim();
  const usernameNormalized = normalizeUsername(cleanUsername);

  const { data: existingProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username_normalized", usernameNormalized)
    .maybeSingle();

  if (lookupError) {
    const message = String(lookupError.message || "").toLowerCase();

    return {
      session: null,
      user: null,
      error: new Error(
        message.includes("username_normalized") ||
          message.includes("schema cache")
          ? "Account setup is not finished. Run the Supabase auth SQL first."
          : lookupError.message || "Could not check username"
      ),
    };
  }

  if (existingProfile) {
    return {
      session: null,
      user: null,
      error: new Error("That username is already taken"),
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: cleanUsername,
        display_name: cleanUsername,
        username_normalized: usernameNormalized,
      },
    },
  });

  return {
    session: data?.session || null,
    user: data?.user || null,
    error,
    username: cleanUsername,
    usernameNormalized,
  };
}

export async function signOut(supabase) {
  if (!supabase?.auth) return { error: null };

  const { error } = await supabase.auth.signOut();
  return { error };
}

export { normalizeUsername };
