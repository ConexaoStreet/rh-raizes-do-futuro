REVOKE EXECUTE ON FUNCTION
  public.ti_database_snapshot(),
  public.ti_review_espro_photo(uuid, text, text),
  public.ti_send_notification(uuid, text, text, text),
  public.ti_snapshot(),
  public.ti_update_setting(text, jsonb)
FROM PUBLIC, anon, authenticated;
