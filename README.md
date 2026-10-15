# AI image generator with free credits

A Next.js app where every new account gets 10 free image credits and each image costs one. Credits are spent
atomically in Postgres, and a Supabase Before User Created hook sends every new signup to
[signupbouncer](https://signupbouncer.com), so throwaway and repeat accounts never get the free credits.

Article: https://signupbouncer.com/guides/ai-image-credits (draft)

## Run it

You need Node 22.18 or later and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```sh
npm install
cp supabase/.env.example supabase/.env   # paste the hook URL and secret from the signupbouncer dashboard
supabase start                            # applies supabase/migrations
cp .env.example .env.local                # paste the keys `supabase status` prints
npm run dev                               # http://127.0.0.1:3000
```

Without `REPLICATE_API_TOKEN` the app returns a bundled sample image and still spends the credit. With a token it
calls `black-forest-labs/flux-schnell` on Replicate.

## Tests

```sh
npm test            # offline: the generate route with Supabase and Replicate mocked, and the sign-up refusal
npm run test:db     # the credits SQL against local Supabase Postgres
npm run test:live   # end to end against a running stack (see test/live.mts)
```

## License

MIT, see `LICENSE`.
