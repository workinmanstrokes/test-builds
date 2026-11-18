#!/usr/bin/env bash
# Run the AI bot team on your local Ollama model.
#
#   ./bots.sh test       game-tester    → playtest/FINDINGS.md
#   ./bots.sh bugs       bug-hunter     → fixes + playtest/BUGS.md
#   ./bots.sh balance    balance-tuner  → tuned numbers + playtest/BALANCE_LOG.md
#   ./bots.sh content    content-writer → new customers/lines/items in data.js
#   ./bots.sh release    release-manager→ check, bump cache, commit, push
#   ./bots.sh cycle      test → bugs → balance → test   (full improvement loop)
#   ./bots.sh chat       open Claude Code here with the local model (talk to any bot)
#
#   MODEL=qwen3:8b ./bots.sh test      # use a different Ollama model
set -euo pipefail
cd "$(dirname "$0")"
MODEL="${MODEL:-qwen3.5:4b}"
URL="http://localhost:11434"

curl -fs "$URL/api/tags" >/dev/null 2>&1 || { echo "Ollama isn't running. Start it: sudo systemctl start ollama"; exit 1; }
[ -d node_modules/playwright ] || { echo "First run: installing tools…"; npm install; npx playwright install --with-deps chromium; }

export ANTHROPIC_API_KEY="" ANTHROPIC_BASE_URL="$URL" ANTHROPIC_AUTH_TOKEN="ollama"
ALLOW=(Read Edit Write Grep Glob "Bash(npm run:*)" "Bash(npm install:*)" "Bash(git add:*)" "Bash(git commit:*)" "Bash(git status:*)" "Bash(git diff:*)" "Bash(git remote:*)" "Bash(git push:*)" "Bash(date:*)")

run() { # $1 = agent, $2 = task
  echo -e "\n\033[1;33m▸ $1\033[0m — $2"
  claude --model "$MODEL" -p "Use the $1 subagent. Task: $2" \
    --permission-mode acceptEdits --allowedTools "${ALLOW[@]}"
}

case "${1:-}" in
  test)    run game-tester     "Playtest the game and write playtest/FINDINGS.md." ;;
  bugs)    run bug-hunter      "Fix the worst bug from playtest/FINDINGS.md or the report Errors." ;;
  balance) run balance-tuner   "Fix the biggest balance problem from playtest/FINDINGS.md." ;;
  content) run content-writer  "${2:-Add 4 new customers and 2 new lines for each job type.}" ;;
  release) run release-manager "Ship the current version." ;;
  cycle)   run game-tester "Playtest and write playtest/FINDINGS.md."
           run bug-hunter "Fix the worst bug if FINDINGS.md lists one, otherwise say no bugs."
           run balance-tuner "Fix the biggest balance problem from playtest/FINDINGS.md."
           run game-tester "Playtest again and update playtest/FINDINGS.md, comparing to last time." ;;
  chat)    exec claude --model "$MODEL" ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
