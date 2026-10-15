-- #region credits-table
-- One row per user: how many image credits they have left.
create table public.credits (
  user_id uuid primary key references auth.users on delete cascade,
  balance integer not null check (balance >= 0)
);

alter table public.credits enable row level security;

-- A signed-in user can read their own balance and nothing else. There is no insert, update or delete policy, so
-- users cannot change balances; only the functions below can.
create policy "read own credits" on public.credits
  for select to authenticated
  using ((select auth.uid()) = user_id);
-- #endregion

-- #region free-credits-trigger
-- Every new user starts with 10 free credits. A signup the hook refuses never reaches auth.users, so it gets none.
create function public.give_free_credits()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.credits (user_id, balance) values (new.id, 10);
  return new;
end;
$$;

create trigger give_free_credits
  after insert on auth.users
  for each row execute function public.give_free_credits();
-- #endregion

-- #region spend-credit
-- Takes one credit from the signed-in user in a single statement and returns the new balance, or null when the
-- balance is already 0. Two requests racing for the last credit cannot both win: the second one waits for the
-- first's row lock, then sees balance 0 and updates nothing.
create function public.spend_credit()
returns integer
language sql
security definer set search_path = ''
as $$
  update public.credits
  set balance = balance - 1
  where user_id = (select auth.uid()) and balance > 0
  returning balance;
$$;

-- Gives one credit back after a failed generation. Only the server (secret key) may call it; if users could, they
-- would mint their own credits from the browser.
create function public.refund_credit(p_user_id uuid)
returns integer
language sql
security definer set search_path = ''
as $$
  update public.credits
  set balance = balance + 1
  where user_id = p_user_id
  returning balance;
$$;

revoke execute on function public.spend_credit() from public, anon;
grant execute on function public.spend_credit() to authenticated;
revoke execute on function public.refund_credit(uuid) from public, anon, authenticated;
grant execute on function public.refund_credit(uuid) to service_role;
-- #endregion

-- The trigger function is not meant to be called over the API.
revoke execute on function public.give_free_credits() from public, anon, authenticated;
