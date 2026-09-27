# Throttle Finds — Inventory App

Нативний iOS-додаток для керування машинами на [throttlefinds.com](https://throttlefinds.com).
Додає / редагує оголошення, заливає фото з телефона і позначає машини проданими.

**Серверів немає і не треба.** Додаток комітить зміни напряму в цей GitHub-репозиторій
через GitHub API, а GitHub Pages автоматично пересобирає сайт після кожного коміту.
Фото стискаються прямо на телефоні: довша сторона до 1600px, JPEG до 900 KiB; окремі мініатюри — до 480px. Маленькі фото не збільшуються.

## Як це працює

```
iPhone (додаток) ──GitHub API──▶ репозиторій ──GitHub Pages──▶ throttlefinds.com
```

- Оголошення = markdown-файл у `_cars/`
- Фото = файли в `images/uploads/`
- "Продано" = поле `sold: true` у файлі машини (сайт показує бейдж SOLD і опускає машину вниз)

## Перша збірка і TestFlight

Потрібно один раз, з будь-якого комп'ютера (Mac не обов'язковий — збірка йде в хмарі Expo):

```bash
npm install -g eas-cli
cd app
npm install
eas login          # безкоштовний акаунт expo.dev
eas init           # прив'яже проєкт до твого Expo-акаунта
eas build --platform ios --profile production
eas submit --platform ios --latest
```

При першому `eas build` CLI попросить залогінитись в Apple Developer і сам створить
сертифікати. `eas submit` заливає збірку в App Store Connect → TestFlight.

Далі в [App Store Connect](https://appstoreconnect.apple.com) → TestFlight →
Internal Testing → додай Apple ID хлопців. Вони ставлять TestFlight з App Store
і приймають запрошення.

> Збірка в TestFlight живе 90 днів — раз на ~3 місяці повторюй
> `eas build ... && eas submit ...` (або налаштуй GitHub Actions, щоб само збиралось).

## Доступ для хлопців (вхід у додаток)

Кожному, хто публікує машини, потрібен GitHub-акаунт з доступом до цього репозиторію:

1. Він реєструється на github.com (безкоштовно)
2. Ти додаєш його: репозиторій → Settings → Collaborators → Add people
3. Він створює токен: github.com → Settings → Developer settings →
   Personal access tokens → **Fine-grained tokens** → Generate new token
   - Repository access: **Only select repositories** → цей репозиторій
   - Permissions → Repository permissions → **Contents: Read and write**
   - Expiration: максимальний (раз на рік оновити)
4. Вставляє токен у додаток на екрані входу — один раз, далі зберігається в
   Keychain телефона

### Опційно: вхід "Sign in with GitHub" без токенів

Якщо не хочеш морочитися з токенами: створи OAuth App на
https://github.com/settings/applications/new (callback URL будь-який,
увімкни **Enable Device Flow**), скопіюй Client ID у
`src/config.ts` → `GITHUB_OAUTH_CLIENT_ID` і перезбери додаток.
Тоді вхід = кнопка + код на github.com/login/device.

## Розробка

```bash
cd app
npm install
npm run typecheck   # перевірка типів
npx expo start      # dev-сервер (додаток Expo Go на телефоні)
```

Конфіг репозиторію/гілки — у `src/config.ts`.


## Надійність публікації (1.0.1)

- Наявні оголошення та їхні URL не змінюються. Нові отримують UUID у назві файла, тому однакові рік/марка/модель не конфліктують.
- Одна нова чернетка та окремі чернетки редагування зберігаються автоматично на цьому телефоні. Після «Draft saved on this phone» можна повернутися пізніше. Видалення застосунку видалить локальні чернетки; вони не синхронізуються між телефонами.
- Зображення чернетки лежать у Documents, не у тимчасовому кеші. Два почергові JSON-знімки дають відновлення попереднього стану після обірваного запису.
- Фото завантажуються зі сталими UUID-іменами. Перед повторною спробою порівнюється Git blob SHA: уже завантажені файли не дублюються, навіть якщо відповідь сервера загубилася.
- Конфлікт редагування не перезаписує чужі правки: поверніться до списку, оновіть його, відкрийте машину й оберіть актуальну версію. Стару чернетку можна спочатку відкрити для перегляду.
- Чернетка очищається після успішної публікації або кнопкою Discard Draft. Видалення чернетки не видаляє вже опубліковані файли з GitHub.
- Токени залишаються в Keychain; у чернетках їх немає. Перевірки API не роблять тестових комітів у бойовий репозиторій.

Перевірки перед релізом:

```bash
npm ci
npm run typecheck
npm test
npx expo install --check
npx expo export --platform ios
```

Тести моделюють GitHub і файлове сховище: обрив відповіді після коміту, збій посеред фото, конфлікт SHA, відновлення чернетки, лапки й Unicode, однакові моделі та валідацію чисел. Нативний вибір/стиснення фото й відновлення після закриття iOS потрібно також перевіряти на iPhone.

## Version 1.1.0 — inventory and photo tools

- Available cars appear before sold cars. Search by make, model, year or VIN; filter All / Available / Sold. Cards / List preference is remembered on the phone.
- Tap a photo for a full-screen view. Drag its **Move** handle to reorder, or use **Move left / Move right** in the viewer. The first photo is the cover.
- **Crop cover · 3:2** supports positioning and zoom, with arrow buttons for precise adjustments. **Use as cover** saves a new compressed photo and thumbnail. Cancel leaves the draft unchanged. The uncropped source is retained while that draft exists; it is not permanent cloud undo history.
- Make/model suggestions work offline, with common US-market options plus values in the loaded inventory. Free typing is always allowed. VIN lookup is not included.
- **Share** opens the iOS share sheet with the public listing URL. For a newly saved listing, wait for the website to finish updating before sharing with a customer.
- Publication labels: **Live** means the saved revision matches the deployed website manifest; **Updating** means the website has not caught up; **Saved** means its live revision is unverified. Legacy listings get a revision marker after their next save in 1.1.0. Status checks run while Inventory is in the foreground; pull down to refresh.
- The website serves `inventory-status.json` with public listing paths and revision markers. Cover areas use 3:2 and preserve framing.

Validation: typecheck, regression tests for ordering/search/crop geometry/revisions, iOS JavaScript export, Jekyll build and an isolated Expo Go simulator preview. Preview uses fake credentials and in-memory GitHub writes; no test listings are published. Crop/save, fullscreen view and button-based reorder/cover selection were checked on the simulator. Automated simulator drags delivered zero movement, so physical-device drag and pinch behavior still needs a TestFlight smoke test.


### Photo performance (next build, not submitted yet)

- Up to **30 photos per listing**, with sequential preparation/upload and retry-safe file names.
- Inventory and photo grids use previews rather than full images. `expo-image` caches images in memory and on disk; full-screen view loads the selected full photo and prefetches at most its two neighbors after it loads. Missing previews fall back to the original; failed loads offer a retry.
- New photos target at most 600 KiB (up to 1600 px on the long edge), previews at most 80 KiB (up to 640 px). Original source pixels are not enlarged. Existing full-size files are retained; `scripts/backfill-thumbnails.py` creates missing previews on macOS.
- Website inventory uses the same previews; detail view and lightbox retain full images. Removed artificial delays when selecting a photo.
- These changes reduce transferred bytes and repeated downloads. They do not promise millisecond cold loads over every connection. Existing installed builds need a new TestFlight build to receive these app changes.
