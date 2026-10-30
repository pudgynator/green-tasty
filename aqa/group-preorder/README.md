# Напрям 1, рівень 2. Підтвердження консолідованого pre-order

**Напрям:** 1. Груповий pre-order на власному розгорнутому застосунку (Backend і Frontend).

**Підхід:** Page Object Model для екранів і окремий API-клієнт для підготовки даних та перевірок, які в інтерфейсі не видно. Playwright виконує сценарії так, як це робить користувач. BDD/Screenplay-каркас курсу в цьому репозиторії відсутній, тому шари зібрані під цей застосунок.

Рівень 2 відповідає `POST /group-reservations/{groupReservationId}/submit`: Owner підтверджує лише кошики зі статусом submitted, однакові страви зливаються за `dishId`, замовлення стає `SubmittedByCustomer`, група — `Submitted`.

## Поведінка, яку фіксують тести

Це відповіді вже розгорнутого бекенду:

| Ситуація | Відповідь |
|---|---|
| Немає підтверджених кошиків | 400, `There are no submitted guest sessions.` |
| Спорожнити вже підтверджений кошик | 400, `Guest session is already submitted.` Бекенд також відхилив би підтвердження групи з повідомленням `Submitted guest sessions do not contain any dishes.`, але через API такий кошик зібрати не можна: страву після submit прибрати не дає |
| Замовлення ще не створене | 400, `Order not found.` |
| Групи не існує | 404, `Group reservation was not found` |
| Бронювання не існує | 404, `Reservation not found.` |
| Бронювання з іншої групи | 400, `Reservation does not belong to this group reservation.` |
| Повторне підтвердження | 400, `Group reservation was submitted.`, код `GroupReservationSubmitted` |
| Не Owner | 403, `Only the reservation owner can perform this action.` |
| Без токена | 401 Unauthorized |

Порожній підтверджений кошик у тесті отримується так: гість додає страву, підтверджує кошик, потім прибирає страву. Сам `POST /guest/sessions/{id}/submit` порожній кошик не приймає.

Непідтверджений кошик у консолідований список і в замовлення ресторану не входить.

## Налаштування

```bash
cd aqa/group-preorder
npm ci
npx playwright install chromium
cp .env.example .env
```

У `.env` вкажіть адресу API, адресу сайту, пошту й пароль клієнта-власника. Для сценарію офіціанта потрібен окремий користувач Cognito у групі Waiter: реєстрація через сайт завжди створює Customer. `.env` не комітиться.

Кожен тест створює своє бронювання на унікальну майбутню дату й скасовує його після себе. Другий клієнт для перевірки «не Owner» реєструється під час тесту; окремого API для видалення користувача Cognito немає, тому email унікальний на запуск.

## Запуск

```bash
npm test                 # усі сценарії рівня 2
npm run test:ui          # Owner підтверджує, офіціант бачить замовлення
npm run test:api         # відмови, повторне підтвердження, не Owner
npm run test:level2      # те саме, відбір за тегом @level2
npm run report           # HTML-звіт
```

Звіт лежить у `playwright-report/`. Для впалого тесту зберігаються screenshot, відео і trace у `test-results/`. Один впалий тест не зупиняє решту.

## CI

Workflow `.github/workflows/aqa-level2.yml` запускає ті самі тести. Секрети репозиторію: `API_BASE_URL`, `UI_BASE_URL`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `WAITER_EMAIL`, `WAITER_PASSWORD`. Звіт і trace викладаються як артефакт навіть якщо частина тестів упала.
