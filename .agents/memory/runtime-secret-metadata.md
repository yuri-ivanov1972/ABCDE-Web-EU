---
name: Runtime configuration versus secret metadata
description: Secure metadata absence can disagree with inherited external-database configuration in this workspace.
---

In this workspace, do not treat an absent result from secure secret-existence metadata as conclusive proof that the backend cannot use its configured external database.

**Why:** On 2026-11-02, metadata reported retailer database secrets absent, but the backend process successfully made authorized read-only connections through its inherited configuration. The earlier documentation-only handoff had incorrectly treated that metadata result as the end of the investigation.

**How to apply:** Before blocking on access or requesting credentials, try a normal application-side read-only connection with bounded timeouts and sanitized success/failure output. Never dump environment variables, inspect credential values or import modules that print connection-string fragments. Distinguish metadata visibility, actual runtime reachability and independently verified published-deployment configuration.
