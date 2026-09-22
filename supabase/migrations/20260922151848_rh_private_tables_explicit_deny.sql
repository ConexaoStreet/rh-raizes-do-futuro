
create policy deny_direct_access on private.manager_review_eligibility
for all to anon, authenticated using (false) with check (false);

create policy deny_direct_access on private.anonymous_manager_reviews
for all to anon, authenticated using (false) with check (false);

create policy deny_direct_access on private.session_security
for all to anon, authenticated using (false) with check (false);

create policy deny_direct_access on private.otp_challenges
for all to anon, authenticated using (false) with check (false);
