import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  CircleHelp,
  Compass,
  CreditCard,
  Ellipsis,
  Heart,
  Plane,
  Building2,
  Home,
  Hotel,
  Landmark,
  LogOut,
  Map,
  MapPin,
  Plus,
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
import { AuthPage, ProfilePage, SettingsPage, TripsPage, TripDetailsIntro } from './AccountPages'
import { ApiError, frontendApi, type TripRecord, type User } from './services/frontendApi'
import romeHotels from './assets/rome-hotels.png'
import amalfiCoast from './assets/amalfi-coast.png'

type NavKey = 'overview' | 'trips' | 'flights' | 'hotels' | 'places' | 'budget' | 'profile' | 'settings'

const navItems: { key: NavKey; label: string; icon: typeof Home }[] = [
  { key: 'overview', label: 'Обзор', icon: Home },
  { key: 'trips', label: 'Мои поездки', icon: Map },
  { key: 'flights', label: 'Авиабилеты', icon: Plane },
  { key: 'hotels', label: 'Отели', icon: Building2 },
  { key: 'places', label: 'Избранные места', icon: MapPin },
  { key: 'budget', label: 'Бюджет', icon: WalletCards },
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

const destinationOptions = [
  { city: 'Москва', country: 'Россия' },
  { city: 'Санкт-Петербург', country: 'Россия' },
  { city: 'Казань', country: 'Россия' },
  { city: 'Сочи', country: 'Россия' },
  { city: 'Калининград', country: 'Россия' },
  { city: 'Владивосток', country: 'Россия' },
  { city: 'Рим', country: 'Италия' },
  { city: 'Милан', country: 'Италия' },
  { city: 'Венеция', country: 'Италия' },
  { city: 'Флоренция', country: 'Италия' },
  { city: 'Париж', country: 'Франция' },
  { city: 'Ницца', country: 'Франция' },
  { city: 'Барселона', country: 'Испания' },
  { city: 'Мадрид', country: 'Испания' },
  { city: 'Лиссабон', country: 'Португалия' },
  { city: 'Стамбул', country: 'Турция' },
  { city: 'Анталья', country: 'Турция' },
  { city: 'Дубай', country: 'ОАЭ' },
  { city: 'Тбилиси', country: 'Грузия' },
  { city: 'Ереван', country: 'Армения' },
  { city: 'Токио', country: 'Япония' },
  { city: 'Сеул', country: 'Южная Корея' },
  { city: 'Прага', country: 'Чехия' },
  { city: 'Берлин', country: 'Германия' },
  { city: 'Вена', country: 'Австрия' },
  { city: 'Будапешт', country: 'Венгрия' },
  { city: 'Амстердам', country: 'Нидерланды' },
  { city: 'Лондон', country: 'Великобритания' },
]

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeNav, setActiveNav] = useState<NavKey>('trips')
  const [modalOpen, setModalOpen] = useState(false)
  const [destinationSuggestionsOpen, setDestinationSuggestionsOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [tripName, setTripName] = useState('')
  const [booking, setBooking] = useState<BookingState>(defaultBooking)
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null)
  const [detailPlanning, setDetailPlanning] = useState(false)
  const [tripsRefreshKey, setTripsRefreshKey] = useState(0)
  const [tripError, setTripError] = useState('')

  const spent = useMemo(() => expenses.reduce((sum, item) => sum + item.value, 0), [])
  const budget = 180000
  const matchingDestinations = useMemo(() => {
    const query = booking.destination.trim().toLocaleLowerCase('ru-RU')
    if (!query) return []
    return destinationOptions
      .filter(({ city, country }) => `${city} ${country}`.toLocaleLowerCase('ru-RU').includes(query))
      .slice(0, 6)
  }, [booking.destination])

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
    if (path === '/' || path === '/overview') setActiveNav('overview')
    else if (path === '/profile') setActiveNav('profile')
    else if (path === '/settings') setActiveNav('settings')
    else if (path.startsWith('/trips')) setActiveNav('trips')
    else if (path === '/flights') setActiveNav('flights')
    else if (path === '/hotels') setActiveNav('hotels')
    else if (path === '/places') setActiveNav('places')
    else if (path === '/budget') setActiveNav('budget')
    else setActiveNav('trips')

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
    overview: '/', trips: '/trips', flights: '/flights', hotels: '/hotels', places: '/places', budget: '/budget', profile: '/profile', settings: '/settings',
  }

  const navigateTo = (key: NavKey) => {
    setActiveNav(key)
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>ROUTEA</span>
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

        <button className="create-button nav-create-button" onClick={() => { setTripError(''); setModalOpen(true) }}><Plus size={18} />Новая поездка</button>

        <div className="sidebar-spacer" />
        <div className="journey-note">
          <div className="postcard-art"><span>✦</span></div>
          <strong>Путешествие начинается с идеи</strong>
          <p>Сохраняйте места и собирайте свой идеальный маршрут.</p>
        </div>
        <nav className="secondary-nav" aria-label="Дополнительные разделы">
          <button className={activeNav === 'settings' ? 'active' : ''} aria-label="Настройки" title="Настройки" onClick={() => navigateTo('settings')}><Settings size={18} /></button>
          <button aria-label="Помощь" title="Помощь" onClick={() => notify('Мы рядом, если нужна помощь')}><CircleHelp size={18} /></button>
        </nav>
        <div className="profile-mini">
          <button className={`avatar ${activeNav === 'profile' ? 'profile-active' : ''}`} aria-label="Открыть профиль" aria-current={activeNav === 'profile' ? 'page' : undefined} onClick={() => navigateTo('profile')}>{initials}</button>
          <button className={`profile-mini-copy ${activeNav === 'profile' ? 'profile-active' : ''}`} onClick={() => navigateTo('profile')}><strong>{user.name}</strong><span>{user.email}</span></button>
        </div>
      </aside>

      <main>
        <div className={`content ${activeNav !== 'overview' ? 'feature-content' : 'overview-content'}`}>
          {activeNav === 'overview' ? <section className="routea-overview">
            <div className="overview-intro">
              <p className="eyebrow coral-text">ПУТЕШЕСТВИЕ НАЧИНАЕТСЯ С ИДЕИ</p>
              <h1>Все детали поездки —<br />в одном маршруте.</h1>
              <p className="overview-lead">Routea собирает планы, билеты, отели и расходы в одном месте — чтобы вы меньше переключались между сервисами и больше думали о самом путешествии.</p>
              <div className="overview-promise"><span>Один план поездки</span><i /><span>Все важные детали</span><i /><span>Бюджет под контролем</span></div>
            </div>

            <div className="overview-photo" style={{ backgroundImage: `url(${amalfiCoast})` }} role="img" aria-label="Амальфитанское побережье Италии">
              <span className="overview-photo-kicker">МЕСТО ДЛЯ СЛЕДУЮЩЕЙ ИСТОРИИ</span>
              <div className="overview-photo-caption"><small>ИДЕЯ ДЛЯ ПОЕЗДКИ</small><strong>Амальфитанское побережье</strong><span>Италия · море, городки и дорога вдоль берега</span></div>
            </div>

            <section className="overview-process">
              <div><p className="eyebrow">ПРОСТО НАЧАТЬ</p><h2>От идеи до путешествия</h2></div>
              <div className="overview-process-steps"><span><i>1</i><b>Создайте поездку</b><small>Город, даты и бюджет</small></span><span><i>2</i><b>Подберите варианты</b><small>Рейс и место проживания</small></span><span><i>3</i><b>Соберите маршрут</b><small>Места и планы по дням</small></span></div>
              <button className="overview-process-cta" onClick={() => { setTripError(''); setModalOpen(true) }}>Начать планирование <ArrowRight /></button>
            </section>
          </section> : activeNav === 'settings' ? (
            <SettingsPage user={user} onUserUpdate={setUser} />
          ) : activeNav === 'profile' ? (
            <ProfilePage user={user} onLogout={logout} />
          ) : activeNav === 'trips' ? (
            location.pathname.match(/^\/trips\/[^/]+$/) && selectedTrip ? (
              detailPlanning ? <TripWorkspace booking={booking} setBooking={setBooking} initialSection="trips" onFindFlights={() => navigateTo('flights')} onFindHotels={() => navigateTo('hotels')} notify={notify} /> : <TripDetailsIntro trip={selectedTrip} booking={booking} onBack={() => navigateTo('trips')} onContinue={() => setDetailPlanning(true)} />
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
            <div className="destination-field">
              <label htmlFor="trip-destination">Город или страна назначения</label>
              <div className="destination-autocomplete">
                <input
                  id="trip-destination"
                  required
                  value={booking.destination}
                  onFocus={() => setDestinationSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setDestinationSuggestionsOpen(false), 120)}
                  onChange={(event) => {
                    setBooking({ ...booking, destination: event.target.value })
                    setDestinationSuggestionsOpen(true)
                  }}
                  placeholder="Начните вводить город"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={destinationSuggestionsOpen && booking.destination.trim().length > 0}
                  aria-controls="destination-suggestions"
                />
                {destinationSuggestionsOpen && booking.destination.trim() && (
                  <div className="destination-suggestions" id="destination-suggestions" role="listbox">
                    {matchingDestinations.length > 0 ? matchingDestinations.map(({ city, country }) => (
                      <button
                        type="button"
                        role="option"
                        key={`${city}-${country}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setBooking({ ...booking, destination: `${city}, ${country}` })
                          setDestinationSuggestionsOpen(false)
                        }}
                      >
                        <MapPin />
                        <span><strong>{city}</strong><small>{country}</small></span>
                      </button>
                    )) : <p>Города не найдены</p>}
                  </div>
                )}
              </div>
            </div>
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
