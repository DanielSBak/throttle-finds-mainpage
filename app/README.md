# Throttle Finds — Inventory App

Нативний iOS-додаток для керування машинами на [throttlefinds.com](https://throttlefinds.com).
Додає / редагує оголошення, заливає фото з телефона і позначає машини проданими.

**Серверів немає і не треба.** Додаток комітить зміни напряму в цей GitHub-репозиторій
через GitHub API, а GitHub Pages автоматично пересобирає сайт після кожного коміту.
Фото стискаються прямо на телефоні (до 1800px, JPEG) перед завантаженням.

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
