import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  CreditCard,
  Ellipsis,
  Fuel,
  Plane,
  Building2,
  Home,
  Hotel,
  Landmark,
  LogOut,
  Map,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Ticket,
  Train,
  Utensils,
  WalletCards,
  X,
  UserRound,
} from 'lucide-react'
import { FlightsView, HotelsView, TripWorkspace, type BookingState, defaultBooking } from './TripPlanner'
import { AuthPage, ProfilePage, TripsPage, TripDetailsIntro } from './AccountPages'
import { ApiError, frontendApi, type TripRecord, type User } from './services/frontendApi'

type NavKey = 'overview' | 'trips' | 'flights' | 'hotels' | 'places' | 'budget' | 'profile'

const navItems: { key: NavKey; label: string; icon: typeof Home }[] = [
  { key: 'overview', label: 'Обзор', icon: Home },
  { key: 'trips', label: 'Мои поездки', icon: Map },
  { key: 'flights', label: 'Авиабилеты', icon: Plane },
  { key: 'hotels', label: 'Отели', icon: Building2 },
  { key: 'places', label: 'Избранные места', icon: MapPin },
  { key: 'budget', label: 'Бюджет', icon: WalletCards },
  { key: 'profile', label: 'Профиль', icon: UserRound },
]

const itinerary = [
  {
    day: 'День 1',
    date: '12 октября',
    label: 'Знакомство с городом',
    color: 'coral',
    items: [
      { time: '10:00', title: 'Колизей', address: 'Piazza del Colosseo, 1', icon: Landmark },
      { time: '13:30', title: 'Обед в Trattoria Luzzi', address: 'Via di S. Giovanni in Laterano, 88', icon: Utensils },
      { time: '16:00', title: 'Римский форум', address: 'Via della Salara Vecchia, 5/6', icon: Landmark },
    ],
  },
  {
    day: 'День 2',
    date: '13 октября',
    label: 'Вечный город',
    color: 'blue',
    items: [
      { time: '09:30', title: 'Пантеон', address: 'Piazza della Rotonda', icon: Landmark },
      { time: '12:00', title: 'Пьяцца Навона', address: 'Piazza Navona', icon: MapPin },
      { time: '18:30', title: 'Закат на холме Пинчо', address: 'Salita del Pincio', icon: Sparkles },
    ],
  },
  {
    day: 'День 3',
    date: '14 октября',
    label: 'Ватикан',
    color: 'yellow',
    items: [
      { time: '09:00', title: 'Музеи Ватикана', address: 'Viale Vaticano', icon: Ticket },
      { time: '14:00', title: 'Собор Святого Петра', address: 'Piazza San Pietro', icon: Landmark },
    ],
  },
]

const expenses = [
  { label: 'Проживание', value: 68000, color: '#ef6f51', icon: Hotel },
  { label: 'Транспорт', value: 28000, color: '#3c79a5', icon: Train },
  { label: 'Питание', value: 22000, color: '#e9ae45', icon: Utensils },
  { label: 'Развлечения', value: 12000, color: '#71956c', icon: Ticket },
]

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeNav, setActiveNav] = useState<NavKey>('overview')
  const [activeDay, setActiveDay] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [tripName, setTripName] = useState('')
  const [search, setSearch] = useState('')
  const [booking, setBooking] = useState<BookingState>(defaultBooking)
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null)
  const [detailPlanning, setDetailPlanning] = useState(false)
  const [tripsRefreshKey, setTripsRefreshKey] = useState(0)
  const [tripError, setTripError] = useState('')

  const spent = useMemo(() => expenses.reduce((sum, item) => sum + item.value, 0), [])
  const budget = 180000
  const percent = Math.round((spent / budget) * 100)

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    if (!frontendApi.getAccessToken()) {
      setUser(null)
      return
    }
    frontendApi.getProfile().then(setUser).catch(() => {
      frontendApi.logout()
      setUser(null)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    const path = location.pathname
    if (path === '/login' || path === '/register') {
      navigate('/', { replace: true })
      return
    }
    if (path === '/profile') setActiveNav('profile')
    else if (path.startsWith('/trips')) setActiveNav('trips')
    else if (path === '/flights') setActiveNav('flights')
    else if (path === '/hotels') setActiveNav('hotels')
    else if (path === '/places') setActiveNav('places')
    else if (path === '/budget') setActiveNav('budget')
    else setActiveNav('overview')

    const tripId = path.match(/^\/trips\/([^/]+)$/)?.[1]
    if (tripId && selectedTrip?.id !== tripId) {
      frontendApi.getTrip(tripId).then((trip) => {
        setSelectedTrip(trip)
        setDetailPlanning(false)
        setBooking((current) => ({ ...current, tripName: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, budget: trip.budget }))
      }).catch((caught) => {
        notify(caught instanceof Error ? caught.message : 'Не удалось открыть поездку.')
        navigate('/trips', { replace: true })
      })
    }
  }, [location.pathname, navigate, selectedTrip?.id, user])

  const routeForNav: Record<NavKey, string> = {
    overview: '/', trips: '/trips', flights: '/flights', hotels: '/hotels', places: '/places', budget: '/budget', profile: '/profile',
  }

  const navigateTo = (key: NavKey) => {
    setActiveNav(key)
    setSidebarOpen(false)
    setDetailPlanning(false)
    navigate(routeForNav[key])
  }

  const createTrip = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTripError('')
    try {
      const trip = await frontendApi.createTrip({ name: tripName, destination: booking.destination, startDate: booking.startDate, endDate: booking.endDate, budget: booking.budget })
      setModalOpen(false)
      setSelectedTrip(trip)
      setBooking((current) => ({ ...current, tripName: trip.name }))
      setTripsRefreshKey((value) => value + 1)
      setTripName('')
      navigateTo('flights')
      notify(`Поездка «${trip.name}» сохранена — найдём билеты`)
    } catch (caught) {
      setTripError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить поездку.')
    }
  }

  const openTrip = (trip: TripRecord) => {
    setSelectedTrip(trip)
    setDetailPlanning(false)
    setBooking((current) => ({ ...current, tripName: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, budget: trip.budget }))
    navigate(`/trips/${trip.id}`)
  }

  const logout = () => {
    frontendApi.logout()
    setUser(null)
    setSelectedTrip(null)
    navigate('/login', { replace: true })
  }

  if (user === undefined) return <div className="app-loading"><span><Compass /></span><p>Открываем Routea…</p></div>
  if (!user) return <AuthPage initialMode={location.pathname === '/register' ? 'register' : 'login'} onModeChange={(mode) => navigate(`/${mode}`)} onAuthenticated={(authenticatedUser) => { setUser(authenticatedUser); navigate('/', { replace: true }) }} />

  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const firstName = user.name.split(/\s+/)[0]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="mobile-close" aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)}><X /></button>
        <div className="brand">
          <div className="brand-mark"><Compass size={22} /></div>
          <span>маршрут</span>
        </div>

        <nav className="main-nav" aria-label="Главная навигация">
          <p className="eyebrow">Меню</p>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={activeNav === item.key ? 'active' : ''}
              onClick={() => navigateTo(item.key)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.key === 'trips' && <b>3</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="journey-note">
          <div className="postcard-art"><span>✦</span></div>
          <strong>Путешествие начинается с идеи</strong>
          <p>Сохраняйте места и собирайте свой идеальный маршрут.</p>
        </div>
        <nav className="secondary-nav">
          <button onClick={() => notify('Настройки откроются в следующей версии')}><Settings size={18} />Настройки</button>
          <button onClick={() => notify('Мы рядом, если нужна помощь')}><CircleHelp size={18} />Помощь</button>
        </nav>
        <div className="profile-mini">
          <button className="avatar" aria-label="Открыть профиль" onClick={() => navigateTo('profile')}>{initials}</button>
          <button className="profile-mini-copy" onClick={() => navigateTo('profile')}><strong>{user.name}</strong><span>{user.email}</span></button>
          <button className="logout-button" onClick={logout}><LogOut size={16} /><span>Выйти из аккаунта</span></button>
        </div>
      </aside>

      {sidebarOpen && <button className="scrim" aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)} />}

      <main>
        <header className="topbar">
          <button className="menu-button" aria-label="Открыть меню" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div className="mobile-brand">маршрут</div>
          <div className="search-wrap">
            <Search size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Найти поездку или место..." />
            <kbd>⌘ K</kbd>
          </div>
          <button className="icon-button notification" aria-label="Уведомления" onClick={() => notify('Новых уведомлений нет')}><Bell size={20} /><i /></button>
          <button className="create-button" onClick={() => { setTripError(''); setModalOpen(true) }}><Plus size={19} />Новая поездка</button>
        </header>

        <div className={`content ${activeNav !== 'overview' ? 'feature-content' : ''}`}>
          {activeNav === 'overview' ? <>
          <section className="welcome-row">
            <div>
              <p className="eyebrow coral-text">Воскресенье, 27 сентября</p>
              <h1>Добрый день, {firstName} <span>✦</span></h1>
              <p>Следующее приключение уже совсем близко.</p>
            </div>
            <div className="weather-pill"><span className="sun">☀</span><div><strong>+24°</strong><small>Рим, ясно</small></div></div>
          </section>

          <section className="trip-hero">
            <div className="hero-copy">
              <div className="hero-topline"><span className="status-dot" />БЛИЖАЙШАЯ ПОЕЗДКА <button aria-label="Действия"><Ellipsis /></button></div>
              <h2>Итальянские<br />каникулы</h2>
              <p className="destination"><MapPin size={17} />Рим, Италия</p>
              <div className="trip-facts">
                <div><CalendarDays /><span><small>Даты</small><strong>12–19 октября</strong></span></div>
                <div><Compass /><span><small>Длительность</small><strong>8 дней</strong></span></div>
                <div><WalletCards /><span><small>Бюджет</small><strong>180 000 ₽</strong></span></div>
              </div>
              <button className="open-trip" onClick={() => navigateTo('trips')}>Открыть поездку <ArrowRight size={18} /></button>
            </div>
            <div className="hero-visual" aria-label="Иллюстрация итальянского путешествия">
              <div className="sun-disc" />
              <div className="cloud cloud-one" /><div className="cloud cloud-two" />
              <div className="colosseum">
                <div className="top-stone" />
                <div className="arches">{Array.from({ length: 12 }).map((_, i) => <i key={i} />)}</div>
                <div className="arches lower">{Array.from({ length: 10 }).map((_, i) => <i key={i} />)}</div>
              </div>
              <div className="cypress one" /><div className="cypress two" />
              <div className="scooter">●<span>━</span>●</div>
              <span className="hero-stamp">ROMA<br /><b>2026</b></span>
            </div>
          </section>

          <section className="stats-grid">
            <article><div className="stat-icon coral-bg"><Map size={20} /></div><div><small>Всего поездок</small><strong>12</strong><span>3 запланировано</span></div><ChevronRight /></article>
            <article><div className="stat-icon blue-bg"><MapPin size={20} /></div><div><small>Сохранено мест</small><strong>47</strong><span>В 8 городах</span></div><ChevronRight /></article>
            <article><div className="stat-icon yellow-bg"><Fuel size={20} /></div><div><small>Пройдено</small><strong>18 420 <em>км</em></strong><span>Почти полмира!</span></div><ChevronRight /></article>
          </section>

          <div className="dashboard-grid">
            <section className="panel route-panel">
              <div className="section-title">
                <div><p className="eyebrow">План путешествия</p><h3>Маршрут по дням</h3></div>
                <button onClick={() => notify('Открыт полный маршрут')}>Весь маршрут <ArrowRight size={17} /></button>
              </div>
              <div className="day-tabs">
                {itinerary.map((day, index) => <button key={day.day} className={activeDay === index ? 'active' : ''} onClick={() => setActiveDay(index)}><strong>{day.day}</strong><span>{day.date}</span></button>)}
              </div>
              <div className="day-heading"><span className={`day-number ${itinerary[activeDay].color}`}>0{activeDay + 1}</span><div><h4>{itinerary[activeDay].label}</h4><p>{itinerary[activeDay].items.length} места · около 7 часов</p></div><button aria-label="Добавить место" onClick={() => notify('Форма добавления места подготовлена')}><Plus /></button></div>
              <div className="timeline">
                {itinerary[activeDay].items.map((place, index) => (
                  <article key={place.title}>
                    <time>{place.time}</time>
                    <div className="timeline-marker"><i />{index < itinerary[activeDay].items.length - 1 && <span />}</div>
                    <div className="place-icon"><place.icon size={19} /></div>
                    <div className="place-copy"><h5>{place.title}</h5><p><MapPin size={13} />{place.address}</p></div>
                    <button aria-label="Действия с местом"><Ellipsis /></button>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel budget-panel">
              <div className="section-title">
                <div><p className="eyebrow">Финансы поездки</p><h3>Бюджет</h3></div>
                <button className="round-more" aria-label="Действия"><Ellipsis /></button>
              </div>
              <div className="budget-overview">
                <div className="donut" style={{ '--value': `${percent * 3.6}deg` } as React.CSSProperties}><div><strong>{percent}%</strong><span>потрачено</span></div></div>
                <div><small>Потрачено</small><strong>{spent.toLocaleString('ru-RU')} ₽</strong><small>из {budget.toLocaleString('ru-RU')} ₽</small></div>
              </div>
              <div className="remaining"><span><i />Осталось</span><strong>{(budget - spent).toLocaleString('ru-RU')} ₽</strong></div>
              <div className="expense-list">
                {expenses.map((expense) => (
                  <div key={expense.label}>
                    <span className="expense-icon" style={{ color: expense.color, background: `${expense.color}18` }}><expense.icon size={17} /></span>
                    <span>{expense.label}</span>
                    <strong>{expense.value.toLocaleString('ru-RU')} ₽</strong>
                  </div>
                ))}
              </div>
              <button className="add-expense" onClick={() => notify('Добавление расхода будет подключено к API')}><Plus size={18} />Добавить расход</button>
            </section>
          </div>

          <section className="ideas-section">
            <div className="section-title">
              <div><p className="eyebrow">Вдохновение рядом</p><h3>Идеи для следующей поездки</h3></div>
              <button onClick={() => notify('Показываем больше направлений')}>Смотреть все <ArrowRight size={17} /></button>
            </div>
            <div className="idea-cards">
              <article className="idea-card japan"><span>Весна · 10 дней</span><div><small>Япония</small><h4>Токио и Киото</h4></div><button aria-label="Сохранить"><Plus /></button></article>
              <article className="idea-card turkey"><span>Выходные · 3 дня</span><div><small>Турция</small><h4>Стамбул</h4></div><button aria-label="Сохранить"><Plus /></button></article>
              <article className="idea-card portugal"><span>Лето · 7 дней</span><div><small>Португалия</small><h4>Лиссабон</h4></div><button aria-label="Сохранить"><Plus /></button></article>
            </div>
          </section>
          </> : activeNav === 'profile' ? (
            <ProfilePage user={user} />
          ) : activeNav === 'trips' ? (
            location.pathname.match(/^\/trips\/[^/]+$/) && selectedTrip ? (
              detailPlanning ? <TripWorkspace booking={booking} setBooking={setBooking} initialSection="trips" onFindFlights={() => navigateTo('flights')} onFindHotels={() => navigateTo('hotels')} notify={notify} /> : <TripDetailsIntro trip={selectedTrip} onBack={() => navigateTo('trips')} onContinue={() => setDetailPlanning(true)} />
            ) : <TripsPage refreshKey={tripsRefreshKey} onCreate={() => { setTripError(''); setModalOpen(true) }} onOpen={openTrip} />
          ) : activeNav === 'flights' ? (
            <FlightsView booking={booking} setBooking={setBooking} onContinue={() => navigateTo('hotels')} notify={notify} />
          ) : activeNav === 'hotels' ? (
            <HotelsView booking={booking} setBooking={setBooking} onBack={() => navigateTo('flights')} onContinue={() => { setDetailPlanning(true); selectedTrip ? navigate(`/trips/${selectedTrip.id}`) : navigateTo('trips') }} notify={notify} />
          ) : (
            <TripWorkspace booking={booking} setBooking={setBooking} initialSection={activeNav} onFindFlights={() => navigateTo('flights')} onFindHotels={() => navigateTo('hotels')} notify={notify} />
          )}
        </div>
      </main>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <form className="modal" onSubmit={createTrip} onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setModalOpen(false)}><X /></button>
            <div className="modal-icon"><ShoppingBag /></div>
            <p className="eyebrow coral-text">Новое приключение</p>
            <h3>Куда отправимся?</h3>
            <label>Название поездки<input autoFocus required value={tripName} onChange={(e) => setTripName(e.target.value)} placeholder="Например, выходные в Казани" /></label>
            <label>Город или страна назначения<input required value={booking.destination} onChange={(e) => setBooking({ ...booking, destination: e.target.value })} placeholder="Рим, Италия" /></label>
            <div className="form-row"><label>Дата начала<input type="date" required value={booking.startDate} onChange={(e) => setBooking({ ...booking, startDate: e.target.value })} /></label><label>Дата окончания<input type="date" required value={booking.endDate} min={booking.startDate} onChange={(e) => setBooking({ ...booking, endDate: e.target.value })} /></label></div>
            <label>Планируемый бюджет<div className="input-suffix"><input type="number" min="0" required value={booking.budget} onChange={(e) => setBooking({ ...booking, budget: Number(e.target.value) })} /><span>₽</span></div></label>
            {tripError && <div className="form-message error" role="alert">{tripError}</div>}
            <button className="submit-trip" type="submit">Создать и найти билеты <ArrowRight /></button>
          </form>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
