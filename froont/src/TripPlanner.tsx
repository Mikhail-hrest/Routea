import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
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
  district: string
  amenities: string[]
}

export type NearbyPlace = {
  id: number
  title: string
  category: 'Достопримечательности' | 'Кафе' | 'Рестораны'
  distance: string
  note: string
  lat: number
  lon: number
  plannedCost?: number
  expenseNote?: string
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
  { id: 1, name: 'Casa Verde Roma', rating: 4.9, reviews: 428, price: 8900, total: 62300, address: 'Via Margutta, 54 · Центр Рима', imagePosition: 'left', district: 'Центр', amenities: ['Wi-Fi', 'Завтрак', 'Фитнес'] },
  { id: 2, name: 'Terrazza Aurelia', rating: 4.8, reviews: 316, price: 10200, total: 71400, address: 'Via Giulia, 18 · Навона', imagePosition: 'center', district: 'Навона', amenities: ['Wi-Fi', 'Завтрак', 'Терраса'] },
  { id: 3, name: 'Palazzo Nuovo', rating: 4.7, reviews: 592, price: 7600, total: 53200, address: 'Via Cavour, 121 · Монти', imagePosition: 'right', district: 'Монти', amenities: ['Wi-Fi', 'Кондиционер', 'Завтрак'] },
]

const nearby: NearbyPlace[] = [
  { id: 1, title: 'Пантеон', category: 'Достопримечательности', distance: '450 м', note: 'Античный храм с крупнейшим неармированным куполом в мире.', lat: 41.8986, lon: 12.4769 },
  { id: 2, title: 'Фонтан Треви', category: 'Достопримечательности', distance: '700 м', note: 'Знаменитый фонтан XVIII века в стиле барокко.', lat: 41.9009, lon: 12.4833 },
  { id: 3, title: 'Sant’Eustachio Il Caffè', category: 'Кафе', distance: '320 м', note: 'Историческая кофейня с фирменным римским эспрессо.', lat: 41.8982, lon: 12.4751 },
  { id: 4, title: 'Roscioli', category: 'Рестораны', distance: '600 м', note: 'Римская кухня, паста carbonara и небольшая энотека.', lat: 41.8959, lon: 12.4723 },
  { id: 5, title: 'Giolitti', category: 'Кафе', distance: '520 м', note: 'Старейшая джелатерия рядом с площадью Монтечиторио.', lat: 41.9004, lon: 12.4806 },
  { id: 6, title: 'Armando al Pantheon', category: 'Рестораны', distance: '480 м', note: 'Семейный ресторан с классической cucina romana.', lat: 41.8982, lon: 12.4769 },
]

type Coordinates = [number, number]
type OSMElement = { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

function distanceInMeters(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const [lat1, lon1] = from.map(radians)
  const [lat2, lon2] = to.map(radians)
  const a = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} км` : `${meters} м`
}

function osmCategory(tags: Record<string, string>): NearbyPlace['category'] | null {
  if (tags.amenity === 'cafe') return 'Кафе'
  if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'Рестораны'
  if (tags.tourism || tags.historic || tags.leisure === 'park' || tags.leisure === 'garden' || tags.amenity === 'place_of_worship') return 'Достопримечательности'
  return null
}

async function geocode(query: string, signal: AbortSignal): Promise<Coordinates | null> {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, { signal, headers: { 'Accept-Language': 'ru,en' } })
  if (!response.ok) throw new Error('Не удалось найти город на карте')
  const results = await response.json() as Array<{ lat: string; lon: string }>
  return results[0] ? [Number(results[0].lat), Number(results[0].lon)] : null
}

function MapCenterUpdater({ center }: { center: Coordinates }) {
  const map = useMap()
  useEffect(() => { map.setView(center, map.getZoom() < 13 ? 15 : map.getZoom()) }, [center, map])
  return null
}

function MapViewportReporter({ onMove }: { onMove: (center: Coordinates) => void }) {
  const map = useMap()
  useMapEvents({ moveend() { const center = map.getCenter(); onMove([center.lat, center.lng]) } })
  return null
}

function mapPinIcon(kind: 'hotel' | 'place', selected = false) {
  const className = kind === 'hotel' ? 'leaflet-hotel-pin' : `leaflet-place-pin${selected ? ' selected' : ''}`
  const html = kind === 'hotel' ? '<span>⌂</span>' : ''
  return L.divIcon({ className: 'routea-leaflet-icon', html: `<div class="${className}">${html}</div>`, iconSize: kind === 'hotel' ? [38, 38] : [42, 42], iconAnchor: kind === 'hotel' ? [19, 19] : [21, 21] })
}

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
        {steps.map((step, index) => <div key={step} className={index < current ? 'done' : index === current ? 'current' : ''}><i>{index < current ? <Check size={12} /> : index + 1}</i><span>{step}</span>{index < steps.length - 1 && <b />}</div>)}
      </div>
    </div>
  )
}

export function FlightsView({ booking, setBooking, onContinue, notify }: SharedProps & { onContinue: () => void }) {
  const [searched, setSearched] = useState(true)
  const [sort, setSort] = useState<'recommended' | 'price' | 'departure'>('recommended')
  const visibleFlights = [...flights].sort((a, b) => sort === 'price' ? a.price - b.price : sort === 'departure' ? a.departure.localeCompare(b.departure) : a.id - b.id)
  return (
    <>
      <FlowHeader current={1} booking={booking} />
      <section className="booking-search panel flight-search-panel">
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

      {searched && <section className="results-section flight-results-section">
        <div className="results-heading"><div><p className="eyebrow">НАЙДЕННЫЕ ВАРИАНТЫ</p><h3>{booking.origin} → {booking.destination}</h3></div><label className="flight-sort">Сортировка<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recommended">Рекомендуемые</option><option value="price">Сначала дешевле</option><option value="departure">По времени вылета</option></select></label></div>
        <div className="flight-list">
          {visibleFlights.map((flight, index) => {
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
  const [sort, setSort] = useState<'recommended' | 'price' | 'rating'>('recommended')
  const [district, setDistrict] = useState('Все районы')
  const [amenity, setAmenity] = useState('Любые удобства')
  const nights = Math.max(1, Math.round((new Date(`${booking.endDate}T12:00:00`).getTime() - new Date(`${booking.startDate}T12:00:00`).getTime()) / 86400000))
  const visibleHotels = hotels
    .filter((hotel) => district === 'Все районы' || hotel.district === district)
    .filter((hotel) => amenity === 'Любые удобства' || hotel.amenities.includes(amenity))
    .sort((a, b) => sort === 'price' ? a.price - b.price : sort === 'rating' ? b.rating - a.rating : a.id - b.id)
  return (
    <>
      <FlowHeader current={2} booking={booking} />
      <section className="results-section hotel-section">
        <div className="results-heading"><div><p className="eyebrow">ПОДБЕРИТЕ МЕСТО ДЛЯ ОТДЫХА</p><h3>Отели в {booking.destination.split(',')[0]}</h3><span className="hotel-stay-dates">{formatDate(booking.startDate)} — {formatDate(booking.endDate)} · {nights} ночей</span></div></div>
        <div className="hotel-filters">
          <label className="hotel-filter featured-filter">Сортировка<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recommended">Рекомендуемые</option><option value="price">Сначала дешевле</option><option value="rating">По рейтингу</option></select></label>
          <label className="hotel-filter">Район<select value={district} onChange={(event) => setDistrict(event.target.value)}><option>Все районы</option><option>Центр</option><option>Навона</option><option>Монти</option></select></label>
          <label className="hotel-filter">Удобства<select value={amenity} onChange={(event) => setAmenity(event.target.value)}><option>Любые удобства</option><option>Wi-Fi</option><option>Завтрак</option><option>Фитнес</option><option>Терраса</option><option>Кондиционер</option></select></label>
        </div>
        <div className="hotel-grid">
          {visibleHotels.map((hotel) => {
            const selected = booking.hotel?.id === hotel.id
            return <article className={`hotel-card ${selected ? 'selected' : ''}`} key={hotel.id}>
              <div className={`hotel-photo photo-${hotel.imagePosition}`} style={{ backgroundImage: `url(${hotelSheet})` }} aria-label={`Фотография отеля ${hotel.name}`} />
              <div className="hotel-body"><div className="hotel-title-line"><div><h4>{hotel.name}</h4><div className="hotel-stars" aria-label={`Рейтинг ${hotel.rating} из 5`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} fill={index < Math.round(hotel.rating) ? 'currentColor' : 'none'} />)}</div></div><span className="hotel-score">{hotel.rating.toFixed(1)}</span></div><p className="hotel-reviews">Превосходно · {hotel.reviews} отзывов</p><p className="hotel-address"><MapPin size={14} />{hotel.address}</p><p className="hotel-description">Уютный отель с удобным расположением для прогулок по историческому центру.</p><div className="hotel-amenities">{hotel.amenities.map((item) => <span key={item}>{item}</span>)}</div></div>
              <div className="hotel-price"><div><strong>{hotel.price.toLocaleString('ru-RU')} ₽</strong><span>за ночь · всего {hotel.total.toLocaleString('ru-RU')} ₽</span></div><button onClick={() => { setBooking({ ...booking, hotel }); notify(`${hotel.name} добавлен в поездку`) }}>{selected ? <><Check size={14} />Выбран</> : 'Выбрать отель'}</button><a href="https://www.booking.com/" target="_blank" rel="noreferrer" aria-label={`Забронировать ${hotel.name}`}><ExternalLink size={15} /></a></div>
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
  const [mapCenter, setMapCenter] = useState<Coordinates>([41.8986, 12.4769])
  const [searchCenter, setSearchCenter] = useState<Coordinates>([41.8986, 12.4769])
  const [hotelCoordinates, setHotelCoordinates] = useState<Coordinates | null>(null)
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>(nearby)
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesError, setPlacesError] = useState('')
  const selectedPlace = typeof activeMarker === 'number' ? nearbyPlaces.find((place) => place.id === activeMarker) : null
  const flightCost = booking.flight?.price ?? 0
  const hotelCost = booking.hotel?.total ?? 0
  const placeExpenses = booking.places.reduce((sum, place) => sum + (place.plannedCost ?? 0), 0)
  const planned = flightCost + hotelCost + booking.otherExpenses + placeExpenses
  const remaining = booking.budget - planned
  const filtered = category === 'Все' ? nearbyPlaces : nearbyPlaces.filter((place) => place.category === category)
  const routePoints: Coordinates[] = booking.hotel && booking.places.length > 0
    ? [hotelCoordinates ?? mapCenter, ...booking.places.map((place) => [place.lat, place.lon] as Coordinates)]
    : []

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    async function locateTrip() {
      try {
        const cityCenter = await geocode(booking.destination, controller.signal)
        if (!cityCenter) throw new Error('Город не найден. Уточните название назначения.')
        let hotelCenter: Coordinates | null = null
        if (booking.hotel) {
          try { hotelCenter = await geocode(`${booking.hotel.address}, ${booking.destination}`, controller.signal) } catch { /* Если адрес отеля не найден, используем центр города. */ }
        }
        if (cancelled) return
        const center = hotelCenter ?? cityCenter
        setMapCenter(center)
        setSearchCenter(center)
        setHotelCoordinates(hotelCenter)
        setActiveMarker(booking.hotel ? 'hotel' : 1)
        setPlacesError('')
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) setPlacesError(error instanceof Error ? error.message : 'Не удалось найти город на карте.')
      }
    }
    locateTrip()
    return () => { cancelled = true; controller.abort() }
  }, [booking.destination, booking.hotel?.id, booking.hotel?.address])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setPlacesLoading(true)
      setPlacesError('')
      const [lat, lon] = searchCenter
      const query = `[out:json][timeout:20];(nwr(around:2500,${lat},${lon})[tourism~"attraction|museum|gallery|viewpoint|artwork|zoo|theme_park"];nwr(around:2500,${lat},${lon})[historic];nwr(around:2500,${lat},${lon})[amenity~"cafe|restaurant|fast_food|place_of_worship"];nwr(around:2500,${lat},${lon})[leisure~"park|garden"]);out center tags;`
      try {
        const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query, signal: controller.signal })
        if (!response.ok) throw new Error('Сервис карты временно недоступен')
        const data = await response.json() as { elements: OSMElement[] }
        const center: Coordinates = hotelCoordinates ?? searchCenter
        const unique = new Map<string, NearbyPlace>()
        for (const element of data.elements) {
          const tags = element.tags ?? {}
          const title = tags.name?.trim()
          const kind = osmCategory(tags)
          const latValue = element.lat ?? element.center?.lat
          const lonValue = element.lon ?? element.center?.lon
          if (!title || !kind || latValue === undefined || lonValue === undefined) continue
          const key = `${title.toLocaleLowerCase()}-${kind}`
          if (unique.has(key)) continue
          const meters = distanceInMeters(center, [latValue, lonValue])
          unique.set(key, {
            id: element.id,
            title,
            category: kind,
            distance: formatDistance(meters),
            note: tags.description ?? tags.cuisine ?? tags.historic ?? tags.tourism ?? 'Место отмечено на OpenStreetMap.',
            lat: latValue,
            lon: lonValue,
          })
        }
        const places = [...unique.values()].sort((a, b) => distanceInMeters(center, [a.lat, a.lon]) - distanceInMeters(center, [b.lat, b.lon]))
        setNearbyPlaces(places)
        if (!booking.hotel) setActiveMarker(places[0]?.id ?? 1)
      } catch (error) {
        if (!controller.signal.aborted) {
          setPlacesError(error instanceof Error ? error.message : 'Не удалось загрузить места с карты.')
          if (Math.abs(searchCenter[0] - 41.8986) < 0.2 && Math.abs(searchCenter[1] - 12.4769) < 0.2) setNearbyPlaces(nearby)
        }
      } finally {
        if (!controller.signal.aborted) setPlacesLoading(false)
      }
    }, 650)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [searchCenter, hotelCoordinates, booking.hotel?.id])

  const addPlace = (place: NearbyPlace, day = 1) => {
    if (booking.places.some((item) => item.id === place.id)) {
      setBooking({ ...booking, places: booking.places.filter((item) => item.id !== place.id) })
      notify(`${place.title} удалено из маршрута`)
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
        <div className="map-explorer-layout">
        <section className="city-map panel">
          <div className="map-toolbar"><div><p className="eyebrow">Интерактивная карта</p><h3>{booking.destination.split(',')[0]} рядом с отелем</h3></div><span><Navigation size={14} />Места в радиусе 2,5 км · OpenStreetMap</span></div>
          <div className="map-canvas">
            <MapContainer center={mapCenter} zoom={15} scrollWheelZoom className="leaflet-map">
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapCenterUpdater center={mapCenter} />
              <MapViewportReporter onMove={setSearchCenter} />
              {routePoints.length > 1 && <Polyline positions={routePoints} pathOptions={{ color: '#df5539', weight: 4, opacity: 0.9 }} />}
              {booking.hotel && <Marker position={hotelCoordinates ?? mapCenter} icon={mapPinIcon('hotel')} eventHandlers={{ click: () => setActiveMarker('hotel') }}>
                <Popup><strong>{booking.hotel.name}</strong><br />Выбранный отель · точка старта маршрута</Popup>
              </Marker>}
              {nearbyPlaces.map((place) => {
                const isSelected = booking.places.some((item) => item.id === place.id)
                return <Marker key={place.id} position={[place.lat, place.lon]} icon={mapPinIcon('place', isSelected)} eventHandlers={{ click: () => setActiveMarker(place.id) }}>
                  <Popup><div className="osm-popup"><small>{place.category} · {place.distance} от отеля</small><strong>{place.title}</strong><p>{place.note}</p><button onClick={() => addPlace(place)}>{isSelected ? 'Удалить из маршрута' : 'Добавить в маршрут'}</button></div></Popup>
                </Marker>
              })}
            </MapContainer>
            <div className="map-info-card">
              {activeMarker === 'hotel' && booking.hotel ? <><span className="map-info-icon hotel"><BedDouble /></span><div><small>Выбранный отель</small><strong>{booking.hotel.name}</strong><p>{booking.hotel.address}</p></div></> : selectedPlace ? <><span className="map-info-icon"><MapPin /></span><div><small>{selectedPlace.category} · {selectedPlace.distance} от отеля</small><strong>{selectedPlace.title}</strong><p>{selectedPlace.note}</p><button onClick={() => addPlace(selectedPlace)}>{booking.places.some((item) => item.id === selectedPlace.id) ? 'Удалить из маршрута' : 'Добавить в маршрут'} {booking.places.some((item) => item.id === selectedPlace.id) ? <Check size={13} /> : <Plus size={13} />}</button></div></> : null}
            </div>
          </div>
        </section>

        <section className="nearby-section">
          <div className="results-heading"><div><p className="eyebrow">Исследуйте район</p><h3>Рядом с отелем</h3></div><span>{placesLoading ? 'Ищем места на карте…' : `Найдено ${nearbyPlaces.length} мест в радиусе 2,5 км`}</span></div>
          {placesError && <p className="map-load-error">{placesError}. Проверьте подключение к интернету и попробуйте снова.</p>}
          <div className="category-tabs">{(['Все', 'Достопримечательности', 'Кафе', 'Рестораны'] as const).map((item) => <button className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
          <div className="nearby-grid">{filtered.map((place) => {
            const added = booking.places.some((item) => item.id === place.id)
            return <article key={place.id}><span className={`nearby-icon category-${place.category === 'Кафе' ? 'cafe' : place.category === 'Рестораны' ? 'food' : 'sight'}`}>{place.category === 'Кафе' ? <Coffee /> : place.category === 'Рестораны' ? <Utensils /> : <Landmark />}</span><div><small>{place.category}</small><h4>{place.title}</h4><p><Navigation size={12} />{place.distance} от отеля</p></div><button className={added ? 'added' : ''} aria-label={added ? `Удалить ${place.title} из маршрута` : `Добавить ${place.title} в маршрут`} title={added ? 'Удалить из маршрута' : 'Добавить в маршрут'} onClick={() => addPlace(place)}>{added ? <Check /> : <Plus />}</button></article>
          })}</div>
          <div className="flow-actions"><button className="secondary-action" onClick={onFindHotels}><ArrowLeft size={17} />К отелям</button><button className="primary-action" onClick={() => setWorkspaceTab('route')}>Составить маршрут <ArrowRight size={17} /></button></div>
        </section>
        </div>
      </>}

      {workspaceTab === 'route' && <section className="route-builder panel">
        <div className="results-heading"><div><p className="eyebrow">План поездки</p><h3>Распределите места по дням</h3></div><span>{booking.places.length} мест добавлено</span></div>
        <div className="route-days">{groupedPlaces.map(({ day, items }) => {
          const dayExpenses = items.reduce((sum, place) => sum + (place.plannedCost ?? 0), 0)
          return <article key={day}>
            <header><span>0{day}</span><div><strong>День {day}</strong><small>{formatDate(new Date(new Date(`${booking.startDate}T12:00:00`).getTime() + (day - 1) * 86400000).toISOString().slice(0, 10))}</small></div><b>{items.length} мест · {dayExpenses.toLocaleString('ru-RU')} ₽</b></header>
            <div className="route-day-body">
              {day === 1 && booking.hotel && <div className="route-place hotel"><BedDouble /><div><strong>{booking.hotel.name}</strong><span>Ваш отель · точка старта</span></div></div>}
              {items.map((place) => <div className="route-place" key={place.id}>
                <MapPin />
                <div className="route-place-details">
                  <strong>{place.title}</strong><span>{place.category} · {place.distance}</span>
                  <div className="place-expense-fields">
                    <label><span>Планируемые расходы</span><div className="place-cost-input"><input type="number" min="0" step="100" value={place.plannedCost ?? ''} placeholder="0" aria-label={`Расходы на ${place.title}`} onChange={(event) => {
                      const value = event.target.value
                      setBooking({ ...booking, places: booking.places.map((item) => item.id === place.id ? { ...item, plannedCost: value === '' ? undefined : Math.max(0, Number(value)) } : item) })
                    }} /><b>₽</b></div></label>
                    <label><span>Заметка</span><input type="text" value={place.expenseNote ?? ''} placeholder="Например: обед на двоих" aria-label={`Заметка к ${place.title}`} onChange={(event) => setBooking({ ...booking, places: booking.places.map((item) => item.id === place.id ? { ...item, expenseNote: event.target.value } : item) })} /></label>
                  </div>
                </div>
                <select aria-label="Перенести в другой день" value={place.day} onChange={(event) => setBooking({ ...booking, places: booking.places.map((item) => item.id === place.id ? { ...item, day: Number(event.target.value) } : item) })}><option value="1">День 1</option><option value="2">День 2</option><option value="3">День 3</option></select>
              </div>)}
              {items.length === 0 && !(day === 1 && booking.hotel) && <button onClick={() => setWorkspaceTab('map')}><Plus />Добавить место</button>}
            </div>
          </article>
        })}</div>
        <div className="flow-actions"><button className="secondary-action" onClick={() => setWorkspaceTab('map')}><ArrowLeft size={17} />К карте</button><button className="primary-action" onClick={() => setWorkspaceTab('budget')}>Посмотреть бюджет <ArrowRight size={17} /></button></div>
      </section>}

      {workspaceTab === 'budget' && <section className="trip-budget-layout">
        <div className="panel budget-summary-large"><p className="eyebrow">Финансы поездки</p><h3>Бюджет путешествия</h3><div className="budget-big-number"><small>Запланировано</small><strong>{planned.toLocaleString('ru-RU')} ₽</strong><span>из {booking.budget.toLocaleString('ru-RU')} ₽</span></div><div className="budget-progress"><i style={{ width: `${Math.min(100, planned / booking.budget * 100)}%` }} /></div><div className={`budget-remain ${remaining < 0 ? 'negative' : ''}`}><span>{remaining >= 0 ? 'Осталось' : 'Превышение бюджета'}</span><strong>{Math.abs(remaining).toLocaleString('ru-RU')} ₽</strong></div></div>
        <div className="panel cost-breakdown"><div className="section-title"><div><p className="eyebrow">Структура расходов</p><h3>Запланировано</h3></div></div><div className="cost-list"><button onClick={onFindFlights}><span className="cost-icon flight"><Plane /></span><div><strong>Авиабилеты</strong><small>{booking.flight ? booking.flight.airline : 'Не выбраны'}</small></div><b>{flightCost ? `${flightCost.toLocaleString('ru-RU')} ₽` : 'Выбрать'} </b><ChevronRight /></button><button onClick={onFindHotels}><span className="cost-icon stay"><Building2 /></span><div><strong>Проживание</strong><small>{booking.hotel ? booking.hotel.name : 'Не выбрано'}</small></div><b>{hotelCost ? `${hotelCost.toLocaleString('ru-RU')} ₽` : 'Выбрать'}</b><ChevronRight /></button><div><span className="cost-icon places"><MapPin /></span><div><strong>Расходы по маршруту</strong><small>{booking.places.filter((place) => (place.plannedCost ?? 0) > 0).length} мест с указанной суммой</small></div><b>{placeExpenses.toLocaleString('ru-RU')} ₽</b></div><div><span className="cost-icon other"><Utensils /></span><div><strong>Прочие расходы</strong><small>Примерный план</small></div><b>{booking.otherExpenses.toLocaleString('ru-RU')} ₽</b></div></div></div>
        <div className="completion-card"><span><Check /></span><div><strong>План поездки готов</strong><p>Билеты, отель, маршрут и бюджет собраны в одном месте.</p></div><button onClick={() => notify('Поездка сохранена в «Мои поездки»')}>Сохранить поездку</button></div>
      </section>}
    </>
  )
}
