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
