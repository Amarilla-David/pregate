# Gate a Vercel deployment

Pregate can run inside the Vercel build. The build installs the release your base branch pins, runs the same check CI runs, and only then starts the framework build. If Pregate denies the change, the build exits non-zero and Vercel marks the deployment **Error**.

You do not need a GitHub Actions workflow for this. If the repository has both, both have to pass.

## Add the recipe

From a project that already has a Pregate contract:

```sh
pregate install --ci vercel
```

Commit the two files it writes:

- `scripts/pregate-vercel-build.sh` installs the pinned linux-x64 binary, verifies it, and runs the gate.
- `vercel.json` sets `buildCommand` so Vercel runs that script instead of the framework default.

GitHub Actions stays available. This writes the workflow and the Vercel recipe together:

```sh
pregate install --ci github,vercel
```

`pregate install --ci github` on its own still writes only the Actions workflow.

If `vercel.json` already has a `buildCommand`, the installer leaves it in place and prints the command to use. A new file looks like this:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "bash scripts/pregate-vercel-build.sh -- npm run build"
}
```

`buildCommand` overrides the Build Command in Project Settings and the `build` script in `package.json` ([Static Configuration with vercel.json](https://vercel.com/docs/project-configuration/vercel-json)). The command after `--` is your framework build. `npm run build` matches what Vercel runs for a framework that has a `build` script. Next.js uses that script when it exists, and `next build` when it does not ([Configuring a Build](https://vercel.com/docs/builds/configure-a-build)). If you have no `build` script, pass the framework command yourself:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "bash scripts/pregate-vercel-build.sh -- next build"
}
```

The same script can live in `package.json` and be what `buildCommand` calls:

```json
{
  "scripts": {
    "build": "next build",
    "pregate:vercel": "bash scripts/pregate-vercel-build.sh -- npm run build"
  }
}
```

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run pregate:vercel"
}
```

Keep `build` as the framework command. Pointing `build` at the Pregate script, and then telling that script to run `npm run build`, would call itself.

## What the build runs

On a preview deployment (`VERCEL_ENV` is not `production`):

1. Find the merge base with `origin/main` (or `PREGATE_PRODUCTION_BRANCH`).
2. Read `.pregate/pregate.lock.json` from that base commit and download that engine. The commit being built cannot pick an older binary by editing its own lock.
3. Verify `SHA256SUMS` and the archive with cosign, the same check the GitHub Actions template uses. The script installs cosign `v3.0.5` for linux-amd64 when it is not already on `PATH`, and checks that binary's SHA-256 before using it.
4. Run `pregate check --ratchet --base <merge-base>`.
5. Run the framework build only if the gate passed.

A preview with no merge base is refused. The gate does not fall back to the pull request's lock.

A production deployment uses the lock in the commit being built (that commit is already on the production branch) and ratchets against the parent commit when there is one. The first commit on a repository, which has no parent, runs `pregate check --all` so the tree is still judged.

The Vercel build image for this recipe is linux x64. The script refuses any other machine. Pregate publishes `pregate-<version>-linux-x64.tar.gz` for that image.

## Preview and production

`VERCEL_ENV` is `production`, `preview`, or `development` ([system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)). The recipe does not skip the gate for either preview or production. A deny fails that deployment:

- A pull request preview becomes **Error**, so the GitHub status for that commit is not Ready.
- A production deployment becomes **Error** and is not promoted.

Vercel for GitHub posts a commit status for each project a commit deploys ([Deploying GitHub Projects with Vercel](https://vercel.com/docs/git/vercel-for-github)). One project uses the context `Vercel`. Another project on the same repository uses `Vercel – <project>` with an en dash. Deployment states are `READY`, `ERROR`, and `CANCELED` ([`vercel list` status values](https://vercel.com/docs/cli/list)). Pregate treats Ready as a pass. Error, Canceled, a skipped deployment, and a missing status are not a pass.

`VERCEL_GIT_PREVIOUS_SHA` is only set when an Ignored Build Step is configured, and it is the previous successful deployment of that branch rather than the pull request base ([system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)). The recipe uses the merge base with the production branch instead, which is the same comparison the Actions workflow makes against `github.event.pull_request.base.sha`.

## Cache

Vercel restores `.vercel/cache` from the previous successful build on the same cache key ([Troubleshooting Build Errors](https://vercel.com/docs/deployments/troubleshoot-a-build)). The recipe keeps the verified archive at `.vercel/cache/pregate/<version>/`. A later build still downloads `SHA256SUMS` and the cosign bundles and checks the cached archive against them. A checksum mismatch downloads the archive again. The cache is keyed by the engine version, so a new pin does not reuse the previous binary.

Failed builds do not update that cache. A denied gate does not leave a bad binary for the next build.

You do not choose the cached paths yourself. Vercel does not offer a setting for which files are cached ([Troubleshooting Build Errors](https://vercel.com/docs/deployments/troubleshoot-a-build)). The `.vercel/cache` directory is the supported place for a tool to keep files between builds.

## See the status from your laptop

`pregate ci status` reads the commit's GitHub statuses and check runs. `pregate ci wait` polls until every required provider has passed, or the timeout ends (10 minutes, every 5 seconds, unless you pass `--timeout` and `--interval`).

```sh
pregate ci status
pregate ci wait --sha <head>
```

A repository with only the Vercel recipe does not wait for Actions. A repository with only the Actions workflow does not wait for Vercel. A repository with both fails if either one is missing, still running, or failing. `pregate ci detect` prints which of those files are present. `pregate doctor` and `pregate status --verbose` name them too.

`pregate ci` needs a GitHub origin, or `PREGATE_GITHUB_REPOSITORY=owner/repo`. It uses `GH_TOKEN` or `GITHUB_TOKEN` when one is set. `PREGATE_GITHUB_API` overrides the API origin, which is how the tests point it at a local server.

## Protect the recipe

A pull request can edit `vercel.json`, the build script, and `package.json`. That is the same limit as a workflow file: the check only runs if those files still run it. Protect `.pregate/`, `vercel.json`, `scripts/pregate-vercel-build.sh`, and the `build` script with CODEOWNERS and a required review, next to `.github/workflows/` when you use Actions too.

`vercel.json` also has `build.env` ([Static Configuration with vercel.json](https://vercel.com/docs/project-configuration/vercel-json)). Vercel recommends project settings for environment variables instead. A value committed there is part of the change under review, so it is not a place to put a secret or to turn the gate off.
