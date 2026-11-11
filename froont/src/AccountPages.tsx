import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  Compass,
  Bell,
  Eye,
  EyeOff,
  CircleDollarSign,
  KeyRound,
  LockKeyhole,
  LogOut,
  Moon,
  Mail,
  MapPin,
  Plus,
  Save,
  Plane,
  ShieldCheck,
  Sun,
  Utensils,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { ApiError, frontendApi, type TripRecord, type User } from './services/frontendApi'
import type { BookingState } from './TripPlanner'

type AuthPageProps = {
  initialMode: 'login' | 'register'
  onAuthenticated: (user: User) => void
  onModeChange: (mode: 'login' | 'register') => void
}

type AuthMode = 'login' | 'register' | 'verify'

export function AuthPage({ initialMode, onAuthenticated, onModeChange }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => setMode(initialMode), [initialMode])

  const changeMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode)
    setError('')
    setSuccess('')
    setPassword('')
    setConfirmation('')
    onModeChange(nextMode)
  }

  const showVerification = () => {
    setMode('verify')
    setPassword('')
    setConfirmation('')
    setVerificationCode('')
    setError('')
    setSuccess('Если этот адрес можно использовать для регистрации, на него отправлен код подтверждения.')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (mode === 'register' && password !== confirmation) {
      setError('Пароли не совпадают.')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'register') {
        await frontendApi.register({ name, email, password })
        showVerification()
      } else if (mode === 'verify') {
        await frontendApi.verifyEmail({ email, code: verificationCode })
        changeMode('login')
        setSuccess('Email подтверждён. Теперь можно войти в аккаунт.')
      } else {
        const result = await frontendApi.login({ email, password })
        onAuthenticated(result.user)
      }
    } catch (caught) {
      if (mode === 'register' && caught instanceof ApiError && caught.status === 409) {
        showVerification()
      } else {
        setError(caught instanceof ApiError ? caught.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.')
      }
    } finally {
      setSubmitting(false)
    }
  }


  const resendCode = async () => {
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      await frontendApi.resendVerification(email)
      setSuccess('Если адрес ожидает подтверждения, новый код отправлен на почту.')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось повторно отправить код.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-flat-page">
      <section className="auth-flat-shell">
        <header className="auth-flat-header">
          <div className="auth-flat-brand">
            <span>ROUTEA</span>
            <svg className="auth-brand-wave" viewBox="0 0 82 12" aria-hidden="true">
              <path d="M1 6C8 0 14 12 21 6S34 0 41 6 54 12 61 6 74 0 81 6" />
            </svg>
          </div>
          <button type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Создать аккаунт' : mode === 'verify' ? 'Вернуться ко входу' : 'Уже есть аккаунт? Войти'}</button>
        </header>

        <div className="auth-flat-content">
          <p className="auth-flat-kicker">ROUTEA / ЛИЧНЫЙ КАБИНЕТ</p>
          <h1>{mode === 'login' ? 'ВХОД' : mode === 'verify' ? 'ПОДТВЕРЖДЕНИЕ' : 'РЕГИСТРАЦИЯ'}</h1>
          <p className="auth-flat-description">{mode === 'login' ? 'Введите данные своего аккаунта.' : mode === 'verify' ? `Введите шестизначный код, отправленный на ${email.trim().toLowerCase()}.` : 'Создайте аккаунт для сохранения поездок.'}</p>

          <form onSubmit={submit} className="auth-flat-form" noValidate>
            {mode === 'register' && <label className="auth-line-field"><span>ВАШЕ ИМЯ <b>*</b></span><div><input autoFocus value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Анна Ковалёва" required minLength={2} /></div></label>}
            {mode !== 'verify' && <label className="auth-line-field"><span>EMAIL <b>*</b></span><div><input autoFocus={mode === 'login'} value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="name@example.ru" required /></div></label>}
            {mode !== 'verify' && <label className="auth-line-field"><span>ПАРОЛЬ <b>*</b></span><div><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Не менее 8 символов" required minLength={8} /><button type="button" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>}
            {mode === 'register' && <label className="auth-line-field"><span>ПОВТОРИТЕ ПАРОЛЬ <b>*</b></span><div><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Введите пароль ещё раз" required /></div></label>}
            {mode === 'register' && <p className="auth-password-note">Пароль: минимум 8 символов, заглавная и строчная буквы, цифра.</p>}
            {mode === 'verify' && <label className="auth-line-field auth-code-field"><span>КОД ИЗ ПИСЬМА <b>*</b></span><div><input autoFocus value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" minLength={6} maxLength={6} required /></div></label>}
            {error && <div className="form-message error" role="alert">{error}</div>}
            {success && <div className="form-message success" role="status"><Check />{success}</div>}
            <button className="auth-flat-submit" disabled={submitting || (mode === 'verify' && verificationCode.length !== 6)}><span>{submitting ? 'ПОДОЖДИТЕ…' : mode === 'login' ? 'ВОЙТИ' : mode === 'verify' ? 'ПОДТВЕРДИТЬ EMAIL' : 'СОЗДАТЬ АККАУНТ'}</span><ArrowRight /></button>
            {mode === 'verify' && <button className="auth-resend-button" type="button" onClick={resendCode} disabled={submitting}>Отправить код повторно</button>}
          </form>
        </div>
      </section>
    </main>
  )
}

export function ProfilePage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const registered = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(user.createdAt))
  return (
    <section className="account-page">
      <div className="page-heading"><div><p className="eyebrow coral-text">Личный кабинет</p><h1>Мой профиль</h1><p>Основные данные вашего аккаунта Routea.</p></div></div>
      <div className="profile-layout">
        <article className="profile-identity panel"><div className="profile-avatar-large">{initials}</div><h2>{user.name}</h2><p>{user.email}</p><span><ShieldCheck />Аккаунт защищён</span><button className="profile-logout-button" onClick={onLogout}><LogOut />Выйти из аккаунта</button></article>
        <article className="profile-details panel"><div className="section-title"><div><p className="eyebrow">Персональные данные</p><h3>Основная информация</h3></div></div><dl><div><dt><UserRound />Имя</dt><dd>{user.name}</dd></div><div><dt><Mail />Email</dt><dd>{user.email}</dd></div><div><dt><CalendarDays />Дата регистрации</dt><dd>{registered}</dd></div></dl></article>
      </div>
    </section>
  )
}

type SettingsState = {
  theme: 'light' | 'dark'
  currency: 'RUB' | 'EUR' | 'USD'
  notifications: { trip: boolean; flights: boolean; budget: boolean }
}

const SETTINGS_KEY = 'routea_preferences'
const defaultSettings: SettingsState = {
  theme: 'light', currency: 'RUB', notifications: { trip: true, flights: true, budget: false },
}

function loadSettings(): SettingsState {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<SettingsState>
    return {
      ...defaultSettings,
      ...saved,
      notifications: { ...defaultSettings.notifications, ...saved.notifications },
    }
  } catch {
    return defaultSettings
  }
}

export function SettingsPage({ user, onUserUpdate }: { user: User; onUserUpdate: (user: User) => void }) {
  const [settings, setSettings] = useState<SettingsState>(loadSettings)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [profileMessage, setProfileMessage] = useState('')

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    document.documentElement.dataset.theme = settings.theme
  }, [settings])

  const updateNotification = (key: keyof SettingsState['notifications'], value: boolean) => {
    setSettings((current) => ({ ...current, notifications: { ...current.notifications, [key]: value } }))
  }

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()
    if (trimmedName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setProfileMessage('Проверьте имя и адрес электронной почты.')
      return
    }
    onUserUpdate({ ...user, name: trimmedName, email: normalizedEmail })
    setProfileMessage('Данные обновлены в текущем сеансе. Для сохранения на сервере нужно подключить API профиля.')
  }

  return (
    <section className="account-page settings-page">
      <div className="page-heading"><div><p className="eyebrow coral-text">Персонализация</p><h1>Настройки</h1><p>Настройте Routea под себя.</p></div></div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="settings-panel-heading"><span><Sun /></span><div><h2>Внешний вид</h2><p>Выберите тему приложения.</p></div></div>
          <div className="theme-options">
            <button type="button" className={settings.theme === 'light' ? 'selected' : ''} onClick={() => setSettings({ ...settings, theme: 'light' })}><Sun />Светлая</button>
            <button type="button" className={settings.theme === 'dark' ? 'selected' : ''} onClick={() => setSettings({ ...settings, theme: 'dark' })}><Moon />Тёмная</button>
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="settings-panel-heading"><span><CircleDollarSign /></span><div><h2>Валюта</h2><p>Валюта для планирования новых расходов.</p></div></div>
          <label className="settings-select-label">Основная валюта
            <select value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value as SettingsState['currency'] })}>
              <option value="RUB">Российский рубль (₽)</option><option value="EUR">Евро (€)</option><option value="USD">Доллар США ($)</option>
            </select>
          </label>
        </section>

        <section className="panel settings-panel settings-notifications">
          <div className="settings-panel-heading"><span><Bell /></span><div><h2>Уведомления</h2><p>Выберите, о чём Routea должна напоминать.</p></div></div>
          <label className="settings-toggle"><span><strong>Напоминания о поездке</strong><small>Перед началом путешествия</small></span><input type="checkbox" checked={settings.notifications.trip} onChange={(event) => updateNotification('trip', event.target.checked)} /><i /></label>
          <label className="settings-toggle"><span><strong>Информация о рейсах</strong><small>Вылет и изменения расписания</small></span><input type="checkbox" checked={settings.notifications.flights} onChange={(event) => updateNotification('flights', event.target.checked)} /><i /></label>
          <label className="settings-toggle"><span><strong>Контроль бюджета</strong><small>Когда расходы приблизятся к лимиту</small></span><input type="checkbox" checked={settings.notifications.budget} onChange={(event) => updateNotification('budget', event.target.checked)} /><i /></label>
        </section>

        <section className="panel settings-panel settings-profile">
          <div className="settings-panel-heading"><span><UserRound /></span><div><h2>Данные профиля</h2><p>Имя и email, указанные в аккаунте.</p></div></div>
          <form onSubmit={saveProfile}>
            <label>Имя<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required /></label>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <button className="primary-action" type="submit"><Save />Сохранить данные</button>
            {profileMessage && <p className="settings-hint" role="status">{profileMessage}</p>}
          </form>
        </section>
      </div>
    </section>
  )
}

type TripsPageProps = {
  refreshKey: number
  onCreate: () => void
  onOpen: (trip: TripRecord) => void
}

export function TripsPage({ refreshKey, onCreate, onOpen }: TripsPageProps) {
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    frontendApi.listTrips().then((result) => { if (mounted) setTrips(result) }).catch((caught) => { if (mounted) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить поездки.') }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [refreshKey])

  return (
    <section className="account-page trips-page">
      <div className="page-heading"><div><p className="eyebrow coral-text">Ваши приключения</p><h1>Мои поездки</h1><p>Все запланированные и завершённые путешествия.</p></div><button className="create-button" onClick={onCreate}><Plus />Новая поездка</button></div>
      {loading ? <div className="state-card panel">Загружаем поездки…</div> : error ? <div className="state-card panel error">{error}</div> : trips.length === 0 ? <div className="empty-trips panel"><span><Compass /></span><p className="eyebrow coral-text">Пока здесь тихо</p><h2>Создайте первую поездку</h2><p>Укажите направление, даты и бюджет — Routea поможет собрать остальной план.</p><button className="primary-action" onClick={onCreate}><Plus />Создать поездку</button></div> : <div className="saved-trips-grid">{trips.map((trip, index) => <article key={trip.id} className={`saved-trip-card trip-tone-${index % 3}`}><div className="saved-trip-cover"><span>Запланировано</span><i><Compass /></i></div><div className="saved-trip-body"><p><MapPin />{trip.destination}</p><h3>{trip.name}</h3><div className="saved-trip-facts"><span><CalendarDays />{formatTripDates(trip.startDate, trip.endDate)}</span><span><WalletCards />{trip.budget.toLocaleString('ru-RU')} ₽</span></div><button onClick={() => onOpen(trip)}>Открыть поездку <ArrowRight /></button></div></article>)}</div>}
    </section>
  )
}

export function TripDetailsIntro({ trip, booking, onBack, onContinue }: { trip: TripRecord; booking: BookingState; onBack: () => void; onContinue: () => void }) {
  const tripPlaces = [...booking.places].sort((a, b) => (a.day ?? 1) - (b.day ?? 1))
  const routeItems = [
    ...(booking.flight ? [{ key: 'flight', day: 1, title: `Вылет в ${trip.destination.split(',')[0]}`, note: `${booking.origin} → ${trip.destination.split(',')[0]} · ${booking.flight.departure}`, Icon: Plane }] : []),
    ...(booking.hotel ? [{ key: 'hotel', day: 1, title: 'Заселение в отель', note: booking.hotel.name, Icon: BedDouble }] : []),
    ...tripPlaces.map((place) => ({ key: `place-${place.id}`, day: place.day ?? 1, title: place.title, note: `${place.category}${place.expenseNote ? ` · ${place.expenseNote}` : ''}`, Icon: MapPin })),
  ].sort((a, b) => a.day - b.day)
  const routeExpenses = booking.places.reduce((sum, place) => sum + (place.plannedCost ?? 0), 0)
  const expenses = [
    { label: 'Авиабилеты', value: booking.flight?.price ?? 0, Icon: Plane },
    { label: 'Проживание', value: booking.hotel?.total ?? 0, Icon: BedDouble },
    { label: 'Места маршрута', value: routeExpenses, Icon: MapPin },
    { label: 'Прочие расходы', value: booking.otherExpenses, Icon: Utensils },
  ]
  const planned = expenses.reduce((sum, item) => sum + item.value, 0)
  const left = trip.budget - planned
  const progress = trip.budget > 0 ? Math.min(100, Math.round(planned / trip.budget * 100)) : 0

  return (
    <section className="trip-detail-intro trip-overview-page">
      <button className="back-link" onClick={onBack}><ArrowLeft />Все поездки</button>
      <header className="trip-overview-heading"><div><p className="eyebrow coral-text">{trip.destination}</p><h1>{trip.name}</h1><p><CalendarDays />{formatTripDates(trip.startDate, trip.endDate)} <span>·</span> Бюджет {trip.budget.toLocaleString('ru-RU')} ₽</p></div><button className="primary-action" onClick={onContinue}>Продолжить планирование <ArrowRight /></button></header>
      <div className="trip-detail-panels">
        <section className="panel trip-itinerary-panel">
          <div className="overview-card-title"><h2>Маршрут</h2><span>{routeItems.length ? `${routeItems.length} пунктов` : 'Пока пусто'}</span></div>
          {routeItems.length ? <div className="trip-detail-timeline">{routeItems.map((item) => {
            const dayDate = new Date(new Date(`${trip.startDate}T12:00:00`).getTime() + (item.day - 1) * 86400000)
            const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(dayDate)
            return <article key={item.key}><time><strong>{date}</strong><small>День {item.day}</small></time><i /><span className="trip-timeline-icon"><item.Icon /></span><div><strong>{item.title}</strong><small>{item.note}</small></div></article>
          })}</div> : <div className="trip-detail-empty"><p>Добавьте билеты, отель и места — они появятся здесь по дням поездки.</p><button onClick={onContinue}>Составить маршрут <ArrowRight /></button></div>}
        </section>
        <aside className="panel trip-budget-panel">
          <div className="overview-card-title"><h2>Бюджет</h2><span>{progress}%</span></div>
          <div className="trip-budget-summary"><div className="trip-budget-donut" style={{ background: `conic-gradient(var(--green) ${progress}%, #e6e8e2 ${progress}%)` }}><div><strong>{planned.toLocaleString('ru-RU')} ₽</strong><small>из {trip.budget.toLocaleString('ru-RU')} ₽</small></div></div><div className="trip-budget-left"><small>Осталось</small><strong className={left < 0 ? 'over-budget' : ''}>{Math.abs(left).toLocaleString('ru-RU')} ₽</strong></div></div>
          <div className="trip-budget-breakdown">{expenses.map(({ label, value, Icon }) => <div key={label}><Icon /><span>{label}</span><strong>{value.toLocaleString('ru-RU')} ₽</strong></div>)}</div>
          <button className="trip-budget-link" onClick={onContinue}>Управление бюджетом <ArrowRight /></button>
        </aside>
      </div>
    </section>
  )
}

function formatTripDates(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
  return `${formatter.format(new Date(`${start}T12:00:00`))} — ${formatter.format(new Date(`${end}T12:00:00`))}`
}
