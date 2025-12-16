# Typing Practice & Keyboard Translator

A multi-language typing practice and instant translation tool built with **React** and **Lucide Icons**.  
Supports real-time word pronunciation, sentence translation, and floating tooltips.

---

## Features

- **Typing Practice Mode**  
  - Practice typing multi-language texts.
  - Highlight correct/incorrect characters in real-time.
  - Accuracy tracking.
  - Auto-scroll reference text.
  - Click on words to see phonetic and translation.

- **Keyboard Translator Mode**  
  - Translate sentences or words instantly.
  - Floating tooltip shows word translation while typing.
  - Speech synthesis for both input and reference text.
  - Offline fallback for translations.

- **Supported Languages**  
  - English (`en-US`)
  - Traditional Chinese (`zh-TW`)
  - Japanese (`ja-JP`)
  - Korean (`ko-KR`)
  - Vietnamese (`vi-VN`)
  - Indonesian (`id-ID`)
  - Hindi (`hi-IN`)
  - Portuguese (`pt-PT`)
  - Arabic (`ar-SA`)
  - German (`de-DE`)
  - Russian (`ru-RU`)
  - Spanish (`es-ES`)
  - French (`fr-FR`)

- **File Upload & Download**  
  - Upload `.txt` files as practice/reference text.
  - Download sample practice file.

- **Real-time Pronunciation**  
  - Auto-speak words when correctly typed.
  - Speak full input or reference text.

- **Floating Tooltip**  
  - Shows word translation and phonetic near cursor.
  - Click to play pronunciation.

- **Keyboard Shortcuts**  
  | Shortcut | Action |
  |----------|--------|
  | Ctrl + P | Toggle practice mode |
  | Ctrl + Enter | Speak full input text |
  | Alt + Enter | Speak current word |
  | Alt + V | Toggle reference panel |
  | Ctrl + I | Focus input box |
  | Ctrl + U | Upload file |
  | Ctrl + Alt + D | Download sample file |
  | Escape | Clear input |

---

## Installation

```bash
# Clone repository
git clone https://github.com/AlexStevenWen/language_keyword.git
cd typing-practice-translator

# Install dependencies
npm install
# or
yarn install

# Start development server
npm start
# or
yarn start
