export function sessionIdentity(
  session: { access_token: string; user: { id: string } } | null,
): string | null {
  if (!session?.user.id) return null;
  try {
    const payload = session.access_token.split(".")[1];
    if (!payload) return null;
    const claims = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { session_id?: unknown };
    if (
      typeof claims.session_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        claims.session_id,
      )
    )
      return null;
    return session.user.id + ":" + claims.session_id;
  } catch {
    return null;
  }
}
