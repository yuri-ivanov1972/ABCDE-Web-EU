# Read-only Maxima photo audit

From the project root:

```sh
node artifacts/api-server/scripts/audit-maxima-photos.mjs
node --test artifacts/api-server/scripts/photo-audit-lib.test.mjs
```

No secrets or database connections are required. Only public HTTPS GET requests
are made. No products, photos, or schemas are changed.

The inventory covers **products exposed by the public Maxima catalogue API**,
not all database records. Every stored photo returned for those products is checked;
products without photos receive a missing-URL row.

Output is in `generated-artifacts/maxima-photo-audit/` (excluded from Git/deployment):

- `photos-needing-review.csv`: issues and inconclusive checks.
- `all-photos.csv`: every processed photo and missing-photo entry.
- `summary.json`: coverage, outcomes, and limitations.
- `inventory.json`: resumable catalogue inventory.
- `results.json`: resumable results checkpoint.

Two workers share a 600 ms request-start gap. Downloads have a 12-second timeout,
5 MiB limit and image decode/pixel limits. Temporary failures and missing-image
statuses receive a second attempt. Eight successive access denials pause that
source host; a rate limit stops further image requests. Paused images are
explicitly marked inconclusive, not broken.

Rerunning resumes the saved snapshot and skips processed rows. To perform a
**new audit**, archive or remove the output directory first. Run only one audit
process at a time. Checkpoints update every 25 rows; interrupted runs can repeat
up to 24 checks. `complete` means the run has processed its inventory, not that
every remote image was reachable.

The original CDN URL is tested from this workspace, and the public production
proxy is tested separately. A cached proxy image can work while its source fails.
403 responses do not prove a stale URL, nor does a valid source guarantee the
same behavior in every visitor's browser.

For missing URLs and repeated 404/410 responses, the checker looks for an
allowlisted `og:image` candidate on the retailer product page. It validates the
candidate image, but **does not automatically verify product identity or update
the database**. Review candidates before applying. Retailer blocking and pages
without server-rendered metadata can prevent candidate discovery.

The checker cannot recognize decodable retailer placeholder graphics. Live
browser failure reporting and periodic scheduling are not included.
