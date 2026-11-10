# Backup and recovery runbook (BR-2)

Operational commands for the database and media backups. Every command here was exercised on
synthetic data and disposable local resources only; none has run against production. Running any of
them against production is a Director gate, as are installing the schedule, uploading off-site and
deploying the media tool to the VPS.

Tools:

- `apps/dashboard/scripts/backup-vault.ts`: the operator CLI on the backup host (the Mac that runs
  ceremonies). It seals, verifies, opens, prunes and restores.
- `infra/media-store-vps/hebun_media_backup.py`: snapshot, verify and restore of media objects on the
  VPS. Python standard library only, like the store.

## Invariants

- Only a sealed `.hbk` file may leave the backup host. Format: AES-256-GCM, header authenticated
  as additional data, fresh nonce per file.
- Nothing unauthenticated is restored. Decrypt writes to `.part` and renames only after the tag and
  the plaintext SHA-256 both verify. A tampered file, the wrong key or the wrong kind is refused
  before `pg_restore` or the media tool sees a byte.
- Files are 0600 and created directories are 0700. The key must be a regular, owner-only, 32-byte
  file. It is never overwritten.
- Backup work refuses below 8 GiB free.
- A connection string is read from an environment variable named by a flag. It is never put in argv
  and never printed.
- `restore-db` restores only into a loopback database. Media `restore` only creates a NEW root and
  never merges into a live store.

## Key

```bash
cd apps/dashboard
npx tsx scripts/backup-vault.ts init-key --key ~/.hebun-keys/vault.key
```

The key must live **apart from what it protects**. Every command that takes `--key` refuses
(`key-location-unsafe`) a key inside the repository, the backup root (`~/Developer/hebun-backups`),
the `--vault`, `--remote-dir` or `--out` directory, or any synchronized location (`Documents`,
`Desktop`, iCloud Drive, `Library/CloudStorage`, Dropbox, Google Drive, OneDrive). Create the
directory first: `mkdir -m 700 ~/.hebun-keys`.

**Escrow (a second copy off this Mac) before any production use.** The key file is 32 raw bytes:

```bash
base64 < ~/.hebun-keys/vault.key | pbcopy   # paste into the password manager item "Hebun backup vault key <key id>"
pbcopy < /dev/null                          # clear the clipboard
```

Never print it to the terminal and never store it next to the backups. To prove the escrowed copy,
rebuild it in a temporary directory outside every protected root and open a real vault with it:

```bash
mkdir -m 700 ~/.hebun-escrow-check && pbpaste | base64 -d > ~/.hebun-escrow-check/vault.key && chmod 600 ~/.hebun-escrow-check/vault.key
npx tsx scripts/backup-vault.ts verify --file <newest>.hbk --key ~/.hebun-escrow-check/vault.key   # keyId must match
rm -rf ~/.hebun-escrow-check && pbcopy < /dev/null
```

The output is the key id. **Losing the key loses every backup sealed with it.** Keep a second copy
offline (password manager or printed), apart from the backups. Where that copy lives is a Director
decision. The key id appears in every vault header, so a vault file says which key it needs.

## Database backup

```bash
# DATABASE_URL must already be set in this shell; it is read by name, not passed as a value.
# The expected target is required: the same values as the production ceremony pins.
export HEBUN_BACKUP_TARGET_SYSTEM_IDENTIFIER=<system identifier> HEBUN_BACKUP_TARGET_DATABASE=<database>
npx tsx scripts/backup-vault.ts backup-db --url-env DATABASE_URL \
  --vault ~/Developer/hebun-backups/vault --key ~/.hebun-keys/vault.key --prune
```

What this does, in order:

1. Checks the free-space floor, then proves the target's identity (`pg_control_system()` system
   identifier and `current_database()`) against the two pins. A wrong or unprovable target is
   refused before `pg_dump` runs. The probe works for a read-only role: `pg_read_all_data` is enough
   for the whole backup (checked on PostgreSQL 18; confirm on Neon at activation).
2. Takes a `pg_dump` through `createValidatedBackup`: TLS `verify-full` for a remote host, a version
   check, and a `pg_restore -l` validation. The dump goes into a private scratch directory.
3. Seals it as `postgres-custom-<UTC>.hbk`.
4. Reads the sealed file back in full and authenticates it.
5. Deletes the plaintext.
6. With `--prune`, applies retention.

**Retention (default):** last 3 backups, plus 7 daily, 4 weekly (ISO week) and 6 monthly. Within
each bucket the newest backup is the one kept.
- Every backup that will be kept is decrypt-verified before anything is deleted, so pruning never
  runs while a kept backup is unreadable.
- The newest backup is always kept.
- Files that are not vault names are never touched.

```bash
npx tsx scripts/backup-vault.ts prune --vault <dir> --kind postgres-custom --key <key>          # dry run
npx tsx scripts/backup-vault.ts prune --vault <dir> --kind postgres-custom --key <key> --apply
```

### Schedule (template, NOT installed)

Installing it is a Director gate: it makes a standing production read and needs `DATABASE_URL`
available to launchd. Template `~/Library/LaunchAgents/com.hebun.backup-db.plist`, daily at 03:15:

```xml
<plist version="1.0"><dict>
  <key>Label</key><string>com.hebun.backup-db</string>
  <key>ProgramArguments</key><array>
    <string>/bin/zsh</string><string>-c</string>
    <string>cd "$HOME/Developer/Hebun AI/apps/dashboard" &amp;&amp; node --env-file=.env.backup node_modules/.bin/tsx scripts/backup-vault.ts backup-db --url-env DATABASE_URL --vault "$HOME/Developer/hebun-backups/vault" --key "$HOME/.hebun-keys/vault.key" --prune</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>15</integer></dict>
  <key>StandardOutPath</key><string>/Users/USER/Developer/hebun-backups/backup-db.log</string>
  <key>StandardErrorPath</key><string>/Users/USER/Developer/hebun-backups/backup-db.log</string>
</dict></plist>
```

`.env.backup` (gitignored, mode 0600) holds `DATABASE_URL` — preferably a read-only backup role — and the two `HEBUN_BACKUP_TARGET_*` pins; without the pins `backup-db` exits 2 and dumps nothing.

The log receives one JSON line per run: file name, sizes, digests and key id. It never receives the
URL or any content. A run that prints `"status":"refused"` exits 1.

## Verify and restore (database)

```bash
npx tsx scripts/backup-vault.ts verify --file <x.hbk> --key <key>    # authenticates; writes nothing
# Restore drill into an EMPTY local database (loopback only):
TARGET_URL=postgresql://postgres@127.0.0.1:55432/restore_check \
  npx tsx scripts/backup-vault.ts restore-db --file <x.hbk> --key <key> --target-url-env TARGET_URL
```

To check a restored database against its source, use `snapshotDatabase` / `compareSnapshots` in
`scripts/lib/restore-drill.ts` (BR-1).

**Production recovery is not a command here.** The tool refuses non-loopback targets on purpose.
In a real incident, the order is:

1. Neon point-in-time restore inside the history window (BR-0). This is the first choice.
2. Otherwise, `open` the newest verified `.hbk`, prove it locally with `restore-db`, then run
   `pg_restore` into a new Neon branch as a Director-gated ceremony.

## Off-site copy

**A local-directory push is not an off-site backup until the cloud copy is checked independently.**
`offsite-push` verifies the copy in `--remote-dir` only and prints `cloudConfirmed: false`. When that
directory is a synchronized folder (for example Google Drive for desktop in mirror mode), confirm
each pushed object from outside this Mac: the provider's checksum must equal the `md5` in the push
result (Google Drive shows it as the file's `md5Checksum`). Until that check has passed for a real
backup, BR2-OFFSITE-1 stays open.

`scripts/lib/offsite-backup.ts` defines a provider-independent `OffsiteTransport` (`head`, `put`,
`get`, `list`, `delete` on whole objects). Its only adapter today is `LocalDirectoryTransport`, a
directory that stands in for the remote. A real provider is a new adapter and a Director gate (cost,
location, credential).

```bash
npx tsx scripts/backup-vault.ts offsite-push  --vault <dir> --kind postgres-custom --key <key> --remote-dir <dir>
npx tsx scripts/backup-vault.ts offsite-pull  --object <name>.hbk --key <key> --remote-dir <dir> --out <dir>
npx tsx scripts/backup-vault.ts offsite-prune --kind postgres-custom --key <key> --remote-dir <dir> [--apply]
```

Rules, enforced by the module, not by the adapter:

- **Only sealed files leave.** The file must have a vault name and authenticate with the key.
  Plaintext, the key file, or a file the key cannot open is refused before the transport is called.
- **Verified after transfer.** The remote size and SHA-256 must equal the local file. A mismatched
  object is deleted and the push is retried.
- **Idempotent.** The same name with the same digest is `already-present`. The same name with a
  different digest is `remote-conflict` and is never overwritten.
- **Bounded retries.** Transient errors are retried up to 4 attempts with exponential backoff.
  Conflicts and refusals are not retried.
- **Checked pull.** A pulled object is checked against the remote digest and authenticated in a
  private staging directory. Only then is it kept, so restore from off-site always goes through
  `offsite-pull` and then `restore-db` or `open`.
- **Safe retention.** Off-site retention pulls and authenticates every object it keeps before it
  deletes anything. If one fails, nothing is deleted, and the newest object is always kept.
- **No key material.** The key never reaches a transport, a result or a log. Results name it by key
  id only.

## Media backup

On the VPS, as the store's user (deploying the tool to the VPS is a Director gate):

```bash
sudo -u hebun-media python3 -I /opt/hebun-media-store/hebun_media_backup.py \
  snapshot /var/lib/hebun-media /var/lib/hebun-media-backup/media-snapshot.tar
python3 -I hebun_media_backup.py verify /var/lib/hebun-media-backup/media-snapshot.tar
```

The snapshot covers objects only. `.tmp-` in-flight writes are skipped; a symlink, a non-regular
file or a foreign name refuses the whole snapshot.

On the backup host:

1. Copy the snapshot over the existing SSH access.
2. Seal it with `seal-media`. It requires the snapshot to be owner-only, refuses the key file, and
   removes the plaintext on success and on failure alike. Then delete the VPS copy:

```bash
npx tsx scripts/backup-vault.ts seal-media --in media-snapshot.tar --vault <dir> --key <key>
```

Python has no authenticated cipher in its standard library, so sealing happens here and not on the
VPS. The plaintext snapshot crosses only the SSH channel.

Restore:

1. `open` the `.hbk` file.
2. Run `verify` on the opened snapshot.
3. Run `restore SNAPSHOT NEW_ROOT` beside the live root.
4. Inspect the result, then stop the service.
5. Swap directories, `chown -R hebun-media:hebun-media`, and start the service.

Steps 3–5 are a Director-gated VPS operation. Objects restore as 0440 in 0700 directories.

**Pairing:** a database backup and a media snapshot are not taken at one point in time. Restoring one
without the other can yield `object-absent` rows or untracked objects. Paired restore is BR-5.

## BR-0 — values to read in the Neon Console

Read these values, record them in the closure, and decide the recovery targets. No credential is
needed or copied.

| What | Where in the Neon Console | Record exactly |
|---|---|---|
| Plan | Organization → Billing → current plan | Plan name exactly as shown (documented history windows: Free 6 h, Launch up to 7 d, Scale up to 30 d) |
| Region | Project → Settings → General | Region id, e.g. `aws-eu-central-1` |
| PITR history window | Project → Settings → Storage / "History retention" (older consoles: "Instant restore") | Configured value in hours or days, and the plan's maximum |
| Branch restored from | Project → Branches | Name of the production branch (e.g. `main`/`production`) and whether it is the project's default |
| Restore method | Branches → Restore (or Backup & Restore) | Whether "Restore to point in time" is enabled, and the earliest restorable timestamp shown |

Then the Director decides two targets:
- **RPO** (maximum acceptable data loss): for example "≤ history window inside it, ≤ 24 h beyond it".
- **RTO** (maximum time to recover).
