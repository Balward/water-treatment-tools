# Working with the AI Agent While Keeping `main` the Only Long-Lived Branch

You can collaborate with the AI agent, review its work in pull requests, and still keep `main` as the single durable branch. The trick is to treat feature branches as disposable scratch pads: open them for a specific change, target `main` in the PR, and delete the branch as soon as the work is merged. Follow the checklist below each time you request help so that `main` remains the source of truth.

## 1. Prepare the Repository

1. **Start clean**: Make sure your local checkout does not have uncommitted changes. Run `git status`—it should say "nothing to commit, working tree clean".
2. **Update `main`**: Pull the latest changes before you ask the agent to help so that the code it sees matches the real `main` branch.
3. **Create a short-lived branch**: Name it after the change you are making. This branch will exist only long enough for the PR review.

```bash
git checkout main
git pull
git checkout -b video-hero-refresh
```

## 2. Share the Starting Point with the Agent

When you open a conversation with the agent:

- Mention that `main` is the only long-lived branch and that you will merge the PR back into it.
- Describe the feature or fix you want.
- Tell the agent whether tests, linters, or build scripts should be run.
- If you have local changes staged already, commit or stash them first. The agent expects a clean working tree.

## 3. Review and Apply the Agent's Changes

1. **Inspect the diff**: After the agent proposes edits, read through the patched files so you understand every change.
2. **Run checks yourself**: Execute the commands the agent recommends (tests, linters, build). Catching failures before committing keeps `main` trustworthy.
3. **Make follow-up tweaks**: If you see small adjustments to make, do them before committing. Ask the agent for help if you need additional edits.

## 4. Commit on the Temporary Branch

Commit once you are happy with the result. Keeping commits focused on a single topic makes review faster.

```bash
git commit -am "Describe the change"
```

- If you need to include assets, confirm they belong in the repo before committing.
- Squash or edit your commits locally if you want a tidy history before opening the PR.

## 5. Push and Open a PR Targeting `main`

1. **Push the branch**:
   ```bash
   git push -u origin video-hero-refresh
   ```
2. **Create the PR**: In the repository UI, choose `video-hero-refresh` as the compare branch and `main` as the base. Mention in the description that the branch is temporary and will be deleted after merge.
3. **Record context**: Paste the final summary or diff from the agent into your project tracking notes or issues so that future you knows why the change happened.

## 6. Undoing or Reworking a Change

If something goes wrong on `main`, you still have options:

- `git revert <commit>` creates a new commit that undoes a previous one without rewriting history.
- `git reset --hard origin/main` discards local edits if you want to start fresh with the remote `main`.
- If you need to experiment, create another temporary branch, test there, and delete it once you are confident again.

## 7. Clean Up After the Merge

1. Merge the PR into `main`.
2. Delete the temporary branch both in the remote UI and locally: `git branch -d video-hero-refresh`.
3. Pull the latest `main` so your local checkout matches the single source of truth.

After cleanup, the only long-lived branch is `main`, but you still get the safety and review benefits of the PR workflow.

## 8. Tips for Smooth Collaborations

- **Be explicit**: Tell the agent exactly which files it may modify and what constraints it must respect.
- **Limit the scope**: Smaller tasks reduce the risk of large, hard-to-review diffs landing directly on `main`.
- **Set expectations**: Ask the agent to include a testing plan or to note that no tests were run.
- **Keep backups**: Tag important milestones or releases so you can quickly roll back if needed.
