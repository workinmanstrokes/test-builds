# Lantern Quest

A roguelike text adventure where a model running in [Ollama](https://ollama.com) on your own
computer is the game master. It narrates, reacts to anything you type, and tracks health, gold
and inventory. Nothing leaves your machine and nothing costs tokens.

## Run it

1. Install Ollama and pull any chat model, for example:

   ```sh
   ollama pull llama3.2
   ```

2. Serve this folder on localhost (Ollama accepts requests from `http://localhost` by default):

   ```sh
   cd lantern-quest
   python3 -m http.server 8080
   ```

3. Open <http://localhost:8080>, pick a model and a setting, and begin.

## Notes

- The model list comes from your Ollama install, so any pulled chat model works. Small models
  (3B to 8B) are playable; larger ones tell better stories.
- Opening `index.html` straight from disk, or from another site, is blocked by Ollama unless you
  start it with `OLLAMA_ORIGINS=*`.
- A run lasts about 14 turns. Progress is saved in the browser so you can resume.
- If Ollama runs on another machine or port, change the address on the start screen.
