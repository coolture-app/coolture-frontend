# Coolture frontend

The Coolture web app: Angular 20 with server-side rendering. The API, database and local stack are in
[coolture-aws](https://github.com/coolture-app/coolture-aws).

## Run locally

Needs Node 24 (`mise install` in this folder gets it) and the local API on `http://localhost:3000`, which `make dev` and
`make seed` in `coolture-aws` start and fill with realistic data. See "Run locally" in its README.

```bash
npm install
npm start          # http://localhost:4200, reloads on every change
```

Place search calls `/geo`, which `npm start` proxies to the geocoder container in coolture-aws, as CloudFront does on
AWS. That container needs a one-time `make geo-index` there. Without it the post form works, with no suggestions.

The development build has a **DEV** pill at the bottom left that picks who the app acts as: a guest (the default), the
demo users Anna, Jan and Ola, the bot that imported the events, or `local_dev`, the admin. Zaloguj opens its menu and
Wyloguj goes back to the guest. The choice is the `coolture_dev_user` cookie, so server-rendered pages fetch as the same
user. All of it lives in `src/app/dev/`, which only `src/environments/dev-tools.development.ts` imports, and that file
replaces `dev-tools.ts` in development builds only, so production builds don't contain it.

## Commands

| Command             | Does                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm start`         | Development server with server rendering                                                                         |
| `npm test`          | Unit tests (Karma, in Chrome)                                                                                    |
| `npm run lint`      | ESLint                                                                                                           |
| `npm run format`    | Prettier                                                                                                         |
| `npm run build`     | Production build into `dist/`                                                                                    |
| `npm run api-types` | Regenerates the API types from `coolture-aws`'s contract. Run it after any contract change and commit the result |

A pre-commit hook runs lint and format. To format on save in VS Code, install the Prettier extension, turn on
"Format On Save" and pick Prettier as the default formatter; it reads the project's settings.

Components with their own usage notes have a README next to them, such as the
[confirmation modal](src/app/core/components/modal/modal-window/README.md).
