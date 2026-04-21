Use the `514` CLI (already installed and authenticated) to list all projects in the current organization.

Run `514 project list --json` and save the JSON output to `/workspace/projects.json`.

The output should be a valid JSON array of project objects. Each project object contains fields like `id`, `name`, `org_id`, `repo_owner`, `repo_name`, `created_at`, `repo_url`, `org_slug`, and `root_path`.
