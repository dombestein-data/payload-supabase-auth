# Documentation

This directory contains the maintained technical and operational documentation
for `@dombestein-data/payload-supabase-auth`.

## Start here

- [Overview](overview.md) explains the project and repository layout.
- [Integration guide](integration.md) is the portable implementation runbook
  for a consuming Payload project.
- [Architecture](architecture.md) describes the internal components and request
  sequences.
- [Security](security.md) defines trust boundaries, MFA behavior, and host
  responsibilities.

## Operations and verification

- [Token exchange](token-exchange.md) documents the one-time-code and Payload
  session protocol.
- [Testing](testing.md) inventories deterministic, integration, and browser
  coverage.
- [Verification](verification.md) lists the local and release-gate commands.

The root [README](../README.md) remains the package's public entry point, while
the root [agents.md](../agents.md) contains repository operating rules.
