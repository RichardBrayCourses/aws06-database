# API Tests And Image Upload Commands

Deploy everything:

```bash
pnpm run deploy-everything
```

Create or update the Cognito test users:

```bash
pnpm run cognito:test-users
```

Run the tests:

```bash
pnpm run api:test
```

Seed the images:

```bash
pnpm run images:init
```

Print the website URL:

```bash
pnpm run ui:url
```
