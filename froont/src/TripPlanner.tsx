import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  ExternalLink,
  Hotel,
  Landmark,
  MapPin,
  Navigation,
  Plane,
  Plus,
  Search,
  Star,
  Utensils,
  WalletCards,
} from 'lucide-react'
import hotelSheet from './assets/rome-hotels.png'

export type Flight = {
  id: number
  airline: string
  logo: string
  departure: string
  arrival: string
  duration: string
  price: number
  stops: string
}

export type HotelOption = {
  id: number
  name: string
  rating: number
  reviews: number
  price: number
  total: number
  address: string
  imagePosition: string
}

export type NearbyPlace = {
  id: number
  title: string
  category: 'Достопримечательности' | 'Кафе' | 'Рестораны'
  distance: string
  note: string
  x: number
  y: number
  day?: number
}

export type BookingState = {
  tripName: string
  destination: string
  origin: string
  startDate: string
  endDate: string
  budget: number
  flight: Flight | null
  hotel: HotelOption | null
  places: NearbyPlace[]
  otherExpenses: number
}

export const defaultBooking: BookingState = {
  tripName: 'Итальянские каникулы',
  destination: 'Рим, Италия',
  origin: 'Москва',
  startDate: '2026-10-12',
  endDate: '2026-10-19',
  budget: 180000,
  flight: null,
  hotel: null,
  places: [],
  otherExpenses: 22000,
}

type SharedProps = {
  booking: BookingState
  setBooking: Dispatch<SetStateAction<BookingState>>
  notify: (message: string) => void
}

const flights: Flight[] = [
  { id: 1, airline: 'Aero Roma', logo: 'AR', departure: '07:15', arrival: '10:20', duration: '4 ч 05 мин', price: 32800, stops: 'Прямой' },
  { id: 2, airline: 'SkyWays', logo: 'SW', departure: '11:40', arrival: '16:25', duration: '5 ч 45 мин', price: 27400, stops: '1 пересадка' },
  { id: 3, airline: 'Volare', logo: 'VO', departure: '18:10', arrival: '21:35', duration: '4 ч 25 мин', price: 35100, stops: 'Прямой' },
]

const hotels: HotelOption[] = [
  { id: 1, name: 'Casa Verde Roma', rating: 4.9, reviews: 428, price: 8900, total: 62300, address: 'Via Margutta, 54 · Центр Рима', imagePosition: 'left' },
  { id: 2, name: 'Terrazza Aurelia', rating: 4.8, reviews: 316, price: 10200, total: 71400, address: 'Via Giulia, 18 · Навона', imagePosition: 'center' },
  { id: 3, name: 'Palazzo Nuovo', rating: 4.7, reviews: 592, price: 7600, total: 53200, address: 'Via Cavour, 121 · Монти', imagePosition: 'right' },
]

const nearby: NearbyPlace[] = [
  { id: 1, title: 'Пантеон', category: 'Достопримечательности', distance: '450 м', note: 'Античный храм с крупнейшим неармированным куполом в мире.', x: 34, y: 28 },
  { id: 2, title: 'Фонтан Треви', category: 'Достопримечательности', distance: '700 м', note: 'Знаменитый фонтан XVIII века в стиле барокко.', x: 65, y: 22 },
  { id: 3, title: 'Sant’Eustachio Il Caffè', category: 'Кафе', distance: '320 м', note: 'Историческая кофейня с фирменным римским эспрессо.', x: 44, y: 58 },
  { id: 4, title: 'Roscioli', category: 'Рестораны', distance: '600 м', note: 'Римская кухня, паста carbonara и небольшая энотека.', x: 24, y: 72 },
  { id: 5, title: 'Giolitti', category: 'Кафе', distance: '520 м', note: 'Старейшая джелатерия рядом с площадью Монтечиторио.', x: 76, y: 64 },
  { id: 6, title: 'Armando al Pantheon', category: 'Рестораны', distance: '480 м', note: 'Семейный ресторан с классической cucina romana.', x: 57, y: 82 },
]

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

function FlowHeader({ current, booking }: { current: number; booking: BookingState }) {
  const steps = ['Город', 'Авиабилеты', 'Отель', 'Маршрут', 'Бюджет']
  return (
    <div className="flow-header">
      <div className="flow-heading">
        <div><p className="eyebrow coral-text">{booking.tripName}</p><h1>{booking.destination}</h1></div>
        <div className="flow-dates"><CalendarDays size={17} /><span>{formatDate(booking.startDate)} — {formatDate(booking.endDate)}</span></div>
      </div>
      <div className="flow-steps">
        {steps.map((step, index) => <div key={step} className={index <= current ? 'done' : ''}><i>{index < current ? <Check size={12} /> : index + 1}</i><span>{step}</span>{index < steps.length - 1 && <b />}</div>)}
      </div>
    </div>
  )
}

export function FlightsView({ booking, setBooking, onContinue, notify }: SharedProps & { onContinue: () => void }) {
  const [searched, setSearched] = useState(true)
  return (
    <>
      <FlowHeader current={1} booking={booking} />
      <section className="booking-search panel">
        <div className="section-title"><div><p className="eyebrow">Подберите удобный рейс</p><h3>Авиабилеты</h3></div><span className="powered-note">Цены демонстрационные</span></div>
        <div className="flight-form">
          <label><span>Откуда</span><div><Navigation size={16} /><input value={booking.origin} onChange={(e) => setBooking({ ...booking, origin: e.target.value })} /></div></label>
          <button className="swap-button" aria-label="Поменять города местами" onClick={() => setBooking({ ...booking, origin: booking.destination, destination: booking.origin })}>⇄</button>
          <label><span>Куда</span><div><MapPin size={16} /><input value={booking.destination} onChange={(e) => setBooking({ ...booking, destination: e.target.value })} /></div></label>
          <label><span>Вылет</span><div><CalendarDays size={16} /><input type="date" value={booking.startDate} onChange={(e) => setBooking({ ...booking, startDate: e.target.value })} /></div></label>
          <label><span>Обратно</span><div><CalendarDays size={16} /><input type="date" value={booking.endDate} onChange={(e) => setBooking({ ...booking, endDate: e.target.value })} /></div></label>
          <button className="primary-action" onClick={() => { setSearched(true); notify('Найдено 3 подходящих рейса') }}><Search size={17} />Найти</button>
        </div>
      </section>

      {searched && <section className="results-section">
        <div className="results-heading"><div><p className="eyebrow">Лучшие варианты</p><h3>{booking.origin} → {booking.destination}</h3></div><span>3 рейса · туда и обратно</span></div>
        <div className="flight-list">
          {flights.map((flight, index) => {
            const selected = booking.flight?.id === flight.id
            return <article className={`flight-card ${selected ? 'selected' : ''}`} key={flight.id}>
              {index === 0 && <span className="best-badge">Оптимальный</span>}
              <div className="airline"><i>{flight.logo}</i><div><strong>{flight.airline}</strong><span>Эконом · багаж включён</span></div></div>
              <div className="flight-time"><div><strong>{flight.departure}</strong><span>{booking.origin}</span></div><div className="flight-line"><small>{flight.duration}</small><b><Plane size={14} /></b><small>{flight.stops}</small></div><div><strong>{flight.arrival}</strong><span>{booking.destination.split(',')[0]}</span></div></div>
              <div className="flight-price"><small>за 1 пассажира</small><strong>{flight.price.toLocaleString('ru-RU')} ₽</strong><div><button onClick={() => { setBooking({ ...booking, flight }); notify(`Рейс ${flight.airline} добавлен в поездку`) }}>{selected ? <><Check size={15} />Выбрано</> : 'Выбрать'}</button><a href="https://www.aviasales.ru/" target="_blank" rel="noreferrer">Купить <ExternalLink size={12} /></a></div></div>
            </article>
          })}
        </div>
        <div className="flow-actions"><button className="secondary-action" onClick={() => notify('Вернуться к созданию можно через «Новая поездка»')}><ArrowLeft size={17} />Назад</button><button className="primary-action" disabled={!booking.flight} onClick={onContinue}>Продолжить к отелям <ArrowRight size={17} /></button></div>
      </section>}
    </>
  )
}

export function HotelsView({ booking, setBooking, onBack, onContinue, notify }: SharedProps & { onBack: () => void; onContinue: () => void }) {
  return (
    <>
      <FlowHeader current={2} booking={booking} />
      <section className="results-section hotel-section">
        <div className="results-heading"><div><p className="eyebrow">Где остановиться</p><h3>Отели в городе {booking.destination.split(',')[0]}</h3></div><span>{formatDate(booking.startDate)} — {formatDate(booking.endDate)} · 7 ночей</span></div>
        <div className="hotel-grid">
          {hotels.map((hotel) => {
            const selected = booking.hotel?.id === hotel.id
            return <article className={`hotel-card ${selected ? 'selected' : ''}`} key={hotel.id}>
              <div className={`hotel-photo photo-${hotel.imagePosition}`} style={{ backgroundImage: `url(${hotelSheet})` }}><span><Star size={13} fill="currentColor" />{hotel.rating}</span>{selected && <i><Check size={16} />Выбран</i>}</div>
              <div className="hotel-body"><p className="hotel-reviews">Превосходно · {hotel.reviews} отзывов</p><h4>{hotel.name}</h4><p className="hotel-address"><MapPin size={14} />{hotel.address}</p><div className="hotel-price"><div><strong>{hotel.price.toLocaleString('ru-RU')} ₽</strong><span>за ночь · {hotel.total.toLocaleString('ru-RU')} ₽ всего</span></div><button onClick={() => { setBooking({ ...booking, hotel }); notify(`${hotel.name} добавлен в поездку`) }}>{selected ? 'Выбрано' : 'Выбрать'}</button></div><a href="https://www.booking.com/" target="_blank" rel="noreferrer">Подробнее / Забронировать <ExternalLink size={13} /></a></div>
            </article>
          })}
        </div>
        <p className="external-disclaimer">Routea не осуществляет бронирование. Финальная стоимость и условия уточняются на сайте партнёра.</p>
        <div className="flow-actions"><button className="secondary-action" onClick={onBack}><ArrowLeft size={17} />К билетам</button><button className="primary-action" disabled={!booking.hotel} onClick={onContinue}>К карте и маршруту <ArrowRight size={17} /></button></div>
      </section>
    </>
  )
}

export function TripWorkspace({ booking, setBooking, initialSection, onFindFlights, onFindHotels, notify }: SharedProps & { initialSection: string; onFindFlights: () => void; onFindHotels: () => void }) {
  const [activeMarker, setActiveMarker] = useState<number | 'hotel'>(booking.hotel ? 'hotel' : 1)
  const [category, setCategory] = useState<'Все' | NearbyPlace['category']>('Все')
  const [workspaceTab, setWorkspaceTab] = useState(initialSection === 'budget' ? 'budget' : 'map')
  const selectedPlace = typeof activeMarker === 'number' ? nearby.find((place) => place.id === activeMarker) : null
  const flightCost = booking.flight?.price ?? 0
  const hotelCost = booking.hotel?.total ?? 0
  const planned = flightCost + hotelCost + booking.otherExpenses
  const remaining = booking.budget - planned
  const filtered = category === 'Все' ? nearby : nearby.filter((place) => place.category === category)

  const addPlace = (place: NearbyPlace, day = 1) => {
    if (booking.places.some((item) => item.id === place.id)) {
      notify('Это место уже есть в маршруте')
      return
    }
    setBooking({ ...booking, places: [...booking.places, { ...place, day }] })
    notify(`${place.title} добавлено в день ${day}`)
  }

  const groupedPlaces = useMemo(() => [1, 2, 3].map((day) => ({ day, items: booking.places.filter((place) => place.day === day) })), [booking.places])

  return (
    <>
      <FlowHeader current={workspaceTab === 'budget' ? 4 : 3} booking={booking} />
      <div className="workspace-tabs"><button className={workspaceTab === 'map' ? 'active' : ''} onClick={() => setWorkspaceTab('map')}><MapPin size={17} />Карта и места</button><button className={workspaceTab === 'route' ? 'active' : ''} onClick={() => setWorkspaceTab('route')}><Navigation size={17} />Маршрут по дням</button><button className={workspaceTab === 'budget' ? 'active' : ''} onClick={() => setWorkspaceTab('budget')}><WalletCards size={17} />Бюджет</button></div>

      {workspaceTab === 'map' && <>
        {!booking.hotel && <div className="setup-alert"><Hotel /><div><strong>Сначала выберите отель</strong><span>Он станет центром карты, а мы покажем интересные места поблизости.</span></div><button onClick={onFindHotels}>Выбрать отель</button></div>}
        <section className="city-map panel">
          <div className="map-toolbar"><div><p className="eyebrow">Интерактивная карта</p><h3>{booking.destination.split(',')[0]} рядом с отелем</h3></div><span><Navigation size={14} />Радиус 1 км</span></div>
          <div className="map-canvas">
            <div className="river" />
            {Array.from({ length: 7 }).map((_, index) => <i className={`road road-${index + 1}`} key={index} />)}
            {booking.hotel && <button className={`map-marker hotel-marker ${activeMarker === 'hotel' ? 'active' : ''}`} style={{ left: '50%', top: '44%' }} onClick={() => setActiveMarker('hotel')}><BedDouble size={18} /><b>Ваш отель</b></button>}
            {nearby.map((place) => <button key={place.id} className={`map-marker place-marker category-${place.category === 'Кафе' ? 'cafe' : place.category === 'Рестораны' ? 'food' : 'sight'} ${activeMarker === place.id ? 'active' : ''}`} style={{ left: `${place.x}%`, top: `${place.y}%` }} onClick={() => setActiveMarker(place.id)}>{place.category === 'Кафе' ? <Coffee /> : place.category === 'Рестораны' ? <Utensils /> : <Landmark />}</button>)}
            <div className="map-info-card">
              {activeMarker === 'hotel' && booking.hotel ? <><span className="map-info-icon hotel"><BedDouble /></span><div><small>Выбранный отель</small><strong>{booking.hotel.name}</strong><p>{booking.hotel.address}</p></div></> : selectedPlace ? <><span className="map-info-icon"><MapPin /></span><div><small>{selectedPlace.category} · {selectedPlace.distance} от отеля</small><strong>{selectedPlace.title}</strong><p>{selectedPlace.note}</p><button onClick={() => addPlace(selectedPlace)}>Добавить в маршрут <Plus size={13} /></button></div></> : null}
            </div>
            <div className="map-legend"><span><i className="legend-hotel" />Отель</span><span><i className="legend-sight" />Места</span><span><i className="legend-food" />Еда</span></div>
          </div>
        </section>

        <section className="nearby-section">
          <div className="results-heading"><div><p className="eyebrow">Исследуйте район</p><h3>Рядом с отелем</h3></div><span>Найдено 6 мест в радиусе 1 км</span></div>
          <div className="category-tabs">{(['Все', 'Достопримечательности', 'Кафе', 'Рестораны'] as const).map((item) => <button className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
          <div className="nearby-grid">{filtered.map((place) => {
            const added = booking.places.some((item) => item.id === place.id)
            return <article key={place.id}><span className={`nearby-icon category-${place.category === 'Кафе' ? 'cafe' : place.category === 'Рестораны' ? 'food' : 'sight'}`}>{place.category === 'Кафе' ? <Coffee /> : place.category === 'Рестораны' ? <Utensils /> : <Landmark />}</span><div><small>{place.category}</small><h4>{place.title}</h4><p><Navigation size={12} />{place.distance} от отеля</p></div><button className={added ? 'added' : ''} onClick={() => addPlace(place)}>{added ? <Check /> : <Plus />}</button></article>
          })}</div>
          <div className="flow-actions"><button className="secondary-action" onClick={onFindHotels}><ArrowLeft size={17} />К отелям</button><button className="primary-action" onClick={() => setWorkspaceTab('route')}>Составить маршрут <ArrowRight size={17} /></button></div>
        </section>
      </>}

      {workspaceTab === 'route' && <section className="route-builder panel">
        <div className="results-heading"><div><p className="eyebrow">План поездки</p><h3>Распределите места по дням</h3></div><span>{booking.places.length} мест добавлено</span></div>
        <div className="route-days">{groupedPlaces.map(({ day, items }) => <article key={day}><header><span>0{day}</span><div><strong>День {day}</strong><small>{formatDate(new Date(new Date(`${booking.startDate}T12:00:00`).getTime() + (day - 1) * 86400000).toISOString().slice(0, 10))}</small></div><b>{items.length} мест</b></header><div className="route-day-body">{day === 1 && booking.hotel && <div className="route-place hotel"><BedDouble /><div><strong>{booking.hotel.name}</strong><span>Ваш отель · точка старта</span></div></div>}{items.map((place) => <div className="route-place" key={place.id}><MapPin /><div><strong>{place.title}</strong><span>{place.category} · {place.distance}</span></div><select aria-label="Перенести в другой день" value={place.day} onChange={(e) => setBooking({ ...booking, places: booking.places.map((item) => item.id === place.id ? { ...item, day: Number(e.target.value) } : item) })}><option value="1">День 1</option><option value="2">День 2</option><option value="3">День 3</option></select></div>)}{items.length === 0 && !(day === 1 && booking.hotel) && <button onClick={() => setWorkspaceTab('map')}><Plus />Добавить место</button>}</div></article>)}</div>
        <div className="flow-actions"><button className="secondary-action" onClick={() => setWorkspaceTab('map')}><ArrowLeft size={17} />К карте</button><button className="primary-action" onClick={() => setWorkspaceTab('budget')}>Посмотреть бюджет <ArrowRight size={17} /></button></div>
      </section>}

      {workspaceTab === 'budget' && <section className="trip-budget-layout">
        <div className="panel budget-summary-large"><p className="eyebrow">Финансы поездки</p><h3>Бюджет путешествия</h3><div className="budget-big-number"><small>Запланировано</small><strong>{planned.toLocaleString('ru-RU')} ₽</strong><span>из {booking.budget.toLocaleString('ru-RU')} ₽</span></div><div className="budget-progress"><i style={{ width: `${Math.min(100, planned / booking.budget * 100)}%` }} /></div><div className={`budget-remain ${remaining < 0 ? 'negative' : ''}`}><span>{remaining >= 0 ? 'Осталось' : 'Превышение бюджета'}</span><strong>{Math.abs(remaining).toLocaleString('ru-RU')} ₽</strong></div></div>
        <div className="panel cost-breakdown"><div className="section-title"><div><p className="eyebrow">Структура расходов</p><h3>Запланировано</h3></div></div><div className="cost-list"><button onClick={onFindFlights}><span className="cost-icon flight"><Plane /></span><div><strong>Авиабилеты</strong><small>{booking.flight ? booking.flight.airline : 'Не выбраны'}</small></div><b>{flightCost ? `${flightCost.toLocaleString('ru-RU')} ₽` : 'Выбрать'} </b><ChevronRight /></button><button onClick={onFindHotels}><span className="cost-icon stay"><Building2 /></span><div><strong>Проживание</strong><small>{booking.hotel ? booking.hotel.name : 'Не выбрано'}</small></div><b>{hotelCost ? `${hotelCost.toLocaleString('ru-RU')} ₽` : 'Выбрать'}</b><ChevronRight /></button><div><span className="cost-icon other"><Utensils /></span><div><strong>Питание и развлечения</strong><small>Примерный план</small></div><b>{booking.otherExpenses.toLocaleString('ru-RU')} ₽</b></div></div></div>
        <div className="completion-card"><span><Check /></span><div><strong>План поездки готов</strong><p>Билеты, отель, маршрут и бюджет собраны в одном месте.</p></div><button onClick={() => notify('Поездка сохранена в «Мои поездки»')}>Сохранить поездку</button></div>
      </section>}
    </>
  )
}
