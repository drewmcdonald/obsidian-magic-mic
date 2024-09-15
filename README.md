# Magic Mic

Record, transcribe, and summarize audio directly into
[Obsidian](https://obsidian.md) with custom assistants.

## Features


### ⭐️ Run custom summary assistants

Summary assistants turn your transcribed memos into useful notes. Set up one
assistant for journal entries and another for meeting notes - it's completely up
to you!


### 📃 Transcribe with spelling and style hints

Seed Magic Mic with a sample of names and acronyms to prevent annoying
misspellings. Be sure to read [OpenAI's docs](https://platform.openai.com/docs/guides/speech-to-text/prompting) to get the most out of this feature.


### 🔴 Record as long as you like

Magic Mic handles long running audio gracefully and intelligently following
OpenAI's best practices.


### 🎧 Transcribe and summarize outside audio

Use your summary assistants on audio that wasn't recorded within Obsidian.
Just add the audio to your vault, open it, and run the 'Transcribe and summarize' command with one of your assistants.


## Getting started

Configure an OpenAI API key in the Magic Mic settings. You can get one from 
https://platform.openai.com/api-keys.

Then, click the Magic Mic icon (the microphone) to begin recording. Click the
icon again to pause or finish recording. A new note will be created with the
audio file, a transcript, and summary generated by your chosen assistant. The
note and audio file are stored in the vault according to your Obsidian settings.

Now that you've gotten the hang of it, try controlling Magic Mic via commands!
You can start, pause, resume, cancel, or finish recording.


## Settings and customization

* Save audio
  * Whether to save audio files into your vault after recording. If `true`,
    audio will be saved according to your "Default location for new attachments"
    setting
  * **Default** true

* Link audio
  * Whether to link the audio file into the new note; ignored if 'save audio' is
    false
  * **Default** true

* Open API Key
  * An OpenAI API key obtained from https://platform.openai.com/api-keys

* Speech to text hints
  * Hint the transcription with words, acronyms, or names that are likely to
    appear in your audio, or with stylized text you want the transcript to
    match. For longer transcriptions that require more than one API call, the
    prompt will be prepended to the final tokens of the previous response to
    improve consistency across segments. 
  * **Default** `''`

* Summary assistant model
  * The [OpenAI model](https://platform.openai.com/docs/models) to use in
    summarizing the transcript
  * **Default** `gpt-4o`

* Summary assistants
  * Summary assistants turn your transcribed memos into useful notes. Provide a
    name and a prompt for each. Add multiple assistants for different purposes,
    and choose between them when you run Magic Mic.
  * **Default** (see below)

<details><summary><strong>Default summary instructions</strong></summary>

```
You are an AI specializing in summarizing transcribed voice notes. Below is a transcript of a spoken recording. Please generate concise notes in markdown format, prioritizing clarity and coherence. Reorganize content into appropriate sections with headers. Do not infer any additional context or information beyond the transcription. Keep the content structured and readable in markdown format, but without using code blocks. Below is the transcribed audio:
```

</details>