# AI image generator with free credits

A Next.js and Supabase app that gives each new account 10 free image credits. A Supabase hook blocks disposable emails
and limits repeat Gmail signups before the account exists.

The walkthrough is
[Build an AI image generator with Next.js and Supabase](https://signupbouncer.com/guides/ai-image-credits).

## What it does

- Gives every new user 10 credits from a trigger on `auth.users`. Each image costs one.
- Spends a credit in one Postgres `update`, so two requests racing for the last credit get one image and one "You are
  out of credits." answer. A failed image gives the credit back.
- Sends every signup to signupbouncer through a Supabase Before User Created hook, before Supabase creates the user.
  With your app in enforce mode, we refuse burner addresses, domains that can't receive mail and repeat signups from
  one Gmail inbox after a few tries. A refused signup never gets a user, so it never gets credits.
- Makes images with FLUX schnell on Replicate. Without a Replicate token, it returns a bundled sample image and still
  spends the credit, so you can try the credit flow without a Replicate account.

The app's own code has no signupbouncer code in it. The hook is configured in `supabase/config.toml`.

## Run it

You need Node 22.18 or later, Docker (or another container runtime the Supabase CLI supports) and the
[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```sh
git clone https://github.com/signupbouncer/nextjs-supabase-ai-image-credits
cd nextjs-supabase-ai-image-credits
npm install
cp supabase/.env.example supabase/.env
```

[Sign up for signupbouncer](https://signupbouncer.com/signup) (the Free plan needs no card). Copy the Hook URL and the
Hook secret from your app's Integration tab into `supabase/.env`. Then start Supabase, which applies the migration:

```sh
supabase start
cp .env.example .env.local
```

Copy the keys `supabase status` prints into `.env.local`, as the next section shows. Then start the app:

```sh
npm run dev
```

Open http://127.0.0.1:3000 and create an account. You land on the home page with 10 credits.

Every signupbouncer app starts in shadow mode, which logs every check and refuses nothing. To refuse signups, choose
Enforce under Mode on your app's Rules tab. A signup at mailinator.com then gets "Please sign up with a permanent
email address." and no credits.

The walkthrough's last section covers deploying to a hosted Supabase project.

## Environment variables

`supabase/.env`, for local Supabase. On a hosted project you paste the same two values in the dashboard, under
Authentication, then Hooks.

| Variable | Value |
| --- | --- |
| `SIGNUPBOUNCER_HOOK_URL` | The Hook URL from your signupbouncer app's Integration tab. |
| `SIGNUPBOUNCER_HOOK_SECRET` | The Hook secret from the same tab (`v1,whsec_...`). |

`.env.local`, for the Next.js app:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The Project URL, `http://127.0.0.1:54321` locally. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The key labelled Publishable (`sb_publishable_...`). |
| `SUPABASE_SECRET_KEY` | The key labelled Secret (`sb_secret_...`). Server only. The route uses it to give a credit back. |
| `REPLICATE_API_TOKEN` | Optional. Leave it empty to use the sample image. |

## Tests

```sh
npm test            # offline: the generate route with Supabase and Replicate mocked, and the sign-up refusal
npm run test:db     # the credits SQL against local Supabase Postgres
npm run test:live   # end to end against a running stack (see test/live.mts)
```

## License

MIT. See `LICENSE`.

## signupbouncer

[signupbouncer](https://signupbouncer.com) checks new signups for burner addresses, repeat signups from one inbox and,
on paid plans, datacenter, VPN and Tor IPs.
