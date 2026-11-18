# Hydraulic Foundry

A pocket press-shop sim. Slam the ram, crush specimens, smelt the scrap into ingots, sell them,
and take on jobs. A foreman called Gus runs the floor and writes new jobs with a model running
in [Ollama](https://ollama.com) on your own device. Nothing leaves the device and nothing costs tokens.

## Controls

- **Tap the press** to slam the ram. **Hold** to push harder and crush faster.
- **Vent** when the gauge is in the green band (60% to 96%) for double scrap.
- **Overdrive** gives 2.5x press pressure for 8 seconds.
- **Auto** slams for you whenever your cylinder can handle the next specimen.
- Space bar works too on a keyboard.

## Run it

1. Start Ollama and pull a chat model:

   ```sh
   ollama serve
   ollama pull qwen3.5:4b
   ```

2. Serve this folder on localhost:

   ```sh
   cd hydraulic-foundry
   python3 -m http.server 8083
   ```

3. Open <http://localhost:8083> on the same device. Open the **Foreman** tab and press **Connect**.

## Without Ollama

The game still works. Gus uses built-in lines and jobs until you connect.

## Notes

- Gus's lines and jobs come from the model, so a bigger model writes better ones.
- Progress and settings are saved in the browser.
- Opening `index.html` straight from disk is blocked by Ollama unless you start it with `OLLAMA_ORIGINS=*`.
