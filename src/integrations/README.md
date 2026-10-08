# Service integrations

Each folder defines one service with `defineService({...})`. To add a service:

1. Create `src/integrations/<id>/index.ts` (copy `discord/index.ts` as a template).
2. Fill in the URL, `allowedDomains` (include any CDN/SSO hosts the app navigates to at top level), the permissions it genuinely needs, the badge policy, and honest `limitations`.
3. Add one import line to `src/integrations/index.ts`.

That's it: the sidebar, add‑service dialog, settings, isolation, crash handling and permissions all come from the host.

Rules:
- Use the service's **official web client**. Do not modify its behaviour.
- Only request permissions the service needs (`media` only for services with calls).
- `customCss` is for cosmetic fixes only.
- If the page title doesn't carry a count, say so in `limitations` rather than guessing.
