import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  MapPin,
  Plus,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { ApiError, frontendApi, type TripRecord, type User } from './services/frontendApi'

type AuthPageProps = {
  initialMode: 'login' | 'register'
  onAuthenticated: (user: User) => void
  onModeChange: (mode: 'login' | 'register') => void
}

export function AuthPage({ initialMode, onAuthenticated, onModeChange }: AuthPageProps) {
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
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
        frontendApi.logout()
        setSuccess('Аккаунт создан. Теперь войдите с указанными данными.')
        setMode('login')
        onModeChange('login')
        setPassword('')
        setConfirmation('')
      } else {
        const result = await frontendApi.login({ email, password })
        onAuthenticated(result.user)
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.')
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
          <button type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Создать аккаунт' : 'Уже есть аккаунт? Войти'}</button>
        </header>

        <div className="auth-flat-content">
          <p className="auth-flat-kicker">ROUTEA / ЛИЧНЫЙ КАБИНЕТ</p>
          <h1>{mode === 'login' ? 'ВХОД' : 'РЕГИСТРАЦИЯ'}</h1>
          <p className="auth-flat-description">{mode === 'login' ? 'Введите данные своего аккаунта.' : 'Создайте аккаунт для сохранения поездок.'}</p>

          <form onSubmit={submit} className="auth-flat-form" noValidate>
            {mode === 'register' && <label className="auth-line-field"><span>ВАШЕ ИМЯ <b>*</b></span><div><input autoFocus value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Анна Ковалёва" required minLength={2} /></div></label>}
            <label className="auth-line-field"><span>EMAIL <b>*</b></span><div><input autoFocus={mode === 'login'} value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="name@example.ru" required /></div></label>
            <label className="auth-line-field"><span>ПАРОЛЬ <b>*</b></span><div><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Не менее 8 символов" required minLength={8} /><button type="button" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
            {mode === 'register' && <label className="auth-line-field"><span>ПОВТОРИТЕ ПАРОЛЬ <b>*</b></span><div><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Введите пароль ещё раз" required /></div></label>}
            {mode === 'register' && <p className="auth-password-note">Пароль: минимум 8 символов, заглавная и строчная буквы, цифра.</p>}
            {error && <div className="form-message error" role="alert">{error}</div>}
            {success && <div className="form-message success" role="status"><Check />{success}</div>}
            <button className="auth-flat-submit" disabled={submitting}><span>{submitting ? 'ПОДОЖДИТЕ…' : mode === 'login' ? 'ВОЙТИ' : 'СОЗДАТЬ АККАУНТ'}</span><ArrowRight /></button>
          </form>
        </div>
      </section>
    </main>
  )
}

export function ProfilePage({ user }: { user: User }) {
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const registered = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(user.createdAt))
  return (
    <section className="account-page">
      <div className="page-heading"><div><p className="eyebrow coral-text">Личный кабинет</p><h1>Мой профиль</h1><p>Основные данные вашего аккаунта Routea.</p></div></div>
      <div className="profile-layout">
        <article className="profile-identity panel"><div className="profile-avatar-large">{initials}</div><h2>{user.name}</h2><p>{user.email}</p><span><ShieldCheck />Аккаунт защищён</span></article>
        <article className="profile-details panel"><div className="section-title"><div><p className="eyebrow">Персональные данные</p><h3>Основная информация</h3></div></div><dl><div><dt><UserRound />Имя</dt><dd>{user.name}</dd></div><div><dt><Mail />Email</dt><dd>{user.email}</dd></div><div><dt><CalendarDays />Дата регистрации</dt><dd>{registered}</dd></div></dl><p className="profile-note"><LockKeyhole />Эти данные доступны только вам. Изменение профиля будет подключено вместе с API.</p></article>
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

export function TripDetailsIntro({ trip, onBack, onContinue }: { trip: TripRecord; onBack: () => void; onContinue: () => void }) {
  return (
    <section className="trip-detail-intro">
      <button className="back-link" onClick={onBack}><ArrowLeft />Все поездки</button>
      <div className="trip-detail-banner">
        <div><p className="eyebrow">Запланированная поездка</p><h1>{trip.name}</h1><p><MapPin />{trip.destination}</p><div><span><CalendarDays />{formatTripDates(trip.startDate, trip.endDate)}</span><span><WalletCards />Бюджет {trip.budget.toLocaleString('ru-RU')} ₽</span></div><button className="open-trip" onClick={onContinue}>Продолжить планирование <ArrowRight /></button></div>
        <div className="trip-detail-art"><Compass /><i /><i /><i /></div>
      </div>
    </section>
  )
}

function formatTripDates(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
  return `${formatter.format(new Date(`${start}T12:00:00`))} — ${formatter.format(new Date(`${end}T12:00:00`))}`
}
