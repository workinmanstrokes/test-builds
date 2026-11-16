# Pocket Tutor

A study app powered by a model running in [Ollama](https://ollama.com) on your own device.
Pick a computer topic and a level, then:

- **Learn**: short lessons that build on each other, with an "explain it simpler" button.
- **Quiz**: multiple-choice questions written by the model, with scoring kept per topic.
- **Ask**: a question box for anything you did not understand.

Nothing leaves your device and nothing costs tokens.

## Run it (computer, or Android with Termux)

1. Start Ollama and pull a chat model:

   ```sh
   ollama serve
   ollama pull qwen3.5:4b
   ```

2. In another terminal, serve this folder on localhost:

   ```sh
   cd pocket-tutor
   python3 -m http.server 8082
   ```

3. Open <http://localhost:8082> in a browser on the same device.

## Notes

- Any pulled chat model shows up in the model list. Bigger models write better lessons and
  more reliable quiz questions.
- The model has no internet access and can be wrong. Treat it as a study partner, not a source.
- Opening `index.html` straight from disk, or from another site, is blocked by Ollama unless
  you start it with `OLLAMA_ORIGINS=*`.
- Scores and settings are saved in the browser.
