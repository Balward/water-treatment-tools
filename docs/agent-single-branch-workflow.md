# Working with the AI Agent on a Single Main Branch

Keeping a single `main` branch is a perfectly valid workflow when you are collaborating with the AI agent. The keys are to make small, reviewable changes, verify the result, and only merge what you are comfortable owning. Use the checklist below each time you request help so that the repository history stays clean and understandable.

## 1. Prepare the Repository

1. **Start clean**: Make sure your local checkout does not have uncommitted changes. Run `git status`—it should say "nothing to commit, working tree clean".
2. **Update `main`**: Pull the latest changes before you ask the agent to help so that the code it sees matches the real `main` branch.

```bash
git checkout main
git pull
```

## 2. Share the Starting Point with the Agent

When you open a conversation with the agent:

- Mention that you are working directly on `main`.
- Describe the feature or fix you want.
- Tell the agent whether tests, linters, or build scripts should be run.
- If you have local changes staged already, commit or stash them first. The agent expects a clean working tree.

## 3. Review and Apply the Agent's Changes

1. **Inspect the diff**: After the agent proposes edits, read through the patched files so you understand every change.
2. **Run checks yourself**: Execute the commands the agent recommends (tests, linters, build). Catching failures before committing keeps `main` trustworthy.
3. **Make follow-up tweaks**: If you see small adjustments to make, do them before committing. Ask the agent for help if you need additional edits.

## 4. Commit Directly to `main`

Commit once you are happy with the result.

```bash
git commit -am "Describe the change"
```

- Keep commits focused on a single topic so the history is easy to read.
- If you need to include assets, confirm they belong in the repo before committing.

## 5. Push and Tag the Conversation

1. **Push to `main`**:
   ```bash
   git push origin main
   ```
2. **Record context**: Paste the final summary or diff from the agent into your project tracking notes or issues so that future you knows why the change happened.

## 6. Undoing or Reworking a Change

If something goes wrong on `main`, you still have options:

- `git revert <commit>` creates a new commit that undoes a previous one without rewriting history.
- `git reset --hard origin/main` discards local edits if you want to start fresh with the remote `main`.
- If you need to experiment, create a temporary branch, test there, and delete it once you are confident again.

## 7. Tips for Smooth Collaborations

- **Be explicit**: Tell the agent exactly which files it may modify and what constraints it must respect.
- **Limit the scope**: Smaller tasks reduce the risk of large, hard-to-review diffs landing directly on `main`.
- **Set expectations**: Ask the agent to include a testing plan or to note that no tests were run.
- **Keep backups**: Tag important milestones or releases so you can quickly roll back if needed.

Following this routine lets you ship changes with the agent while keeping your repository on a single, tidy `main` branch.
