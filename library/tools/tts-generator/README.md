# AI Today Brief — ElevenLabs Audio Scenes Automation Tool

Універсальний інструмент для автоматичного вивантаження та структурування аудіо-файлів озвучки з **ElevenLabs** для щоденних/тижневих дайджестів.

---

## 📁 Структура інструменту

* [elevenlabs_console_zip_exporter.js](file:///E:/domains/ai-today-brief/library/tools/tts-generator/elevenlabs_console_zip_exporter.js) — Браузерний скрипт для консолі DevTools. Знаходить усі згенеровані сцени в панелі History, пакує їх у пам'яті в єдиний ZIP-архів і завантажує одним кліком (минаючи блокування масових завантажень у Chrome).
* [unpack_audio_scenes.js](file:///E:/domains/ai-today-brief/library/tools/tts-generator/unpack_audio_scenes.js) — Node.js скрипт, який автоматично витягує завантажений ZIP з папки `Downloads` і розкладає аудіо в цільову директорію `library/DD.MM.YYYY/audio_scenes/`.

---

## 🚀 Покрокова інструкція для майбутніх генерацій

### Крок 1: Згенеруйте сцени в ElevenLabs
1. Відкрийте [ElevenLabs Text to Speech](https://elevenlabs.io/app/speech-synthesis/text-to-speech).
2. Озвучте необхідні сцени (вони автоматично з'являться в правій панелі **History**).

### Крок 2: Експорт у ZIP одним кліком
1. На сторінці ElevenLabs відкрийте DevTools (**F12 → Console**).
2. Скопіюйте вміст [elevenlabs_console_zip_exporter.js](file:///E:/domains/ai-today-brief/library/tools/tts-generator/elevenlabs_console_zip_exporter.js), вставте в консоль і натисніть `Enter`.
3. У папку `Downloads` автоматично завантажиться файл `ai_today_brief_audio_scenes.zip`.

### Крок 3: Автоматичне розпакування у папку поточної дати
У терміналі проєкту запустіть:
```bash
node library/tools/tts-generator/unpack_audio_scenes.js
```
*(Або вкажіть конкретну дату: `node library/tools/tts-generator/unpack_audio_scenes.js 01.09.2026`)*

Усі аудіо миттєво з'являться у відповідній папці:
`E:\domains\ai-today-brief\library\<ДАТА>\audio_scenes\scene_01_cold_open.mp3` тощо.
