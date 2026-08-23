---
title: Skol Arena is now open source
description: The source is public, the image is on Docker Hub, and the documentation is online. Here is what that means if you want to run your own instance.
date: 2026-08-23
tag: Announcement
---

Skol Arena has been running real competitions for months — championships that stretch over
weeks, elimination brackets drawn from a finished season, and a ranked ladder that never
stops. All of it was built in the open in spirit and closed in practice: the Docker image
was published, but the source behind it was not, and the only documentation was whatever
you could infer from the interface.

That ends with this release. **The repository is public, licensed under AGPL-3.0.** The
image, the documentation, and the code that produces both now sit in the same place.

## What is available

- **The source** — the full monorepo: the API, the web app, the shared schemas, and the
  documentation site you are reading. Issues and pull requests are open.
- **The image** — `quent1l/skol-arena` on Docker Hub, published automatically for every
  released version, plus a `latest` tag.
- **The documentation** — a [self-hosting guide](/docs) with every environment variable,
  a full Docker Compose setup, and a reference explaining how
  [matches](/docs/matches), [disciplines and scoring](/docs/disciplines),
  [MMR](/docs/mmr) and [accounts](/docs/accounts) actually behave.

## Running your own instance

The application ships as a single container holding the API, the built frontend, and its
database migrations, which run at startup. You bring a PostgreSQL database and nothing
else:

```bash
docker pull quent1l/skol-arena:latest
```

The [deployment guide](/docs/deployment) has the Compose file, the reverse-proxy notes,
and how the first administrator account is created. If you want to know what you are
signing up for before you spin anything up, [Features](/features) is the tour and
[About](/about) is the reasoning behind the design.

## Why AGPL

Skol Arena is meant to be run by clubs, workplaces, bars, and independent organizers on
their own hardware, with their own data. The AGPL keeps that true for everyone
downstream: modify it, deploy it, run it for your community — and if you offer it to
others as a service, the changes go back to the commons.

## What comes next

Releases are cut from conventional commits, so every version lands with its own changelog
and a matching image tag. This blog is where the ones worth explaining get written up in
plain language — what changed for the people playing, not just what changed in the code.

If you run an instance, break something, or want a mode that does not exist yet, the issue
tracker is the place. It is a real project used by real leagues, and it gets better fastest
when the people running them say what is missing.
