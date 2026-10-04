export type User = {
  id: string
  name: string
  email: string
  createdAt: string
}

type StoredUser = User & { passwordHash: string }

export type TripRecord = {
  id: string
  ownerId: string
  name: string
  destination: string
  startDate: string
  endDate: string
  budget: number
  status: 'planned' | 'active' | 'completed'
  createdAt: string
}

export type CreateTripPayload = Pick<TripRecord, 'name' | 'destination' | 'startDate' | 'endDate' | 'budget'>

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const KEYS = {
  users: 'routea_users',
  trips: 'routea_trips',
  token: 'routea_access_token',
  currentUserId: 'routea_current_user_id',
}

const delay = (ms = 180) => new Promise((resolve) => window.setTimeout(resolve, ms))

function readList<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[]
  } catch {
    return []
  }
}

function writeList<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value))
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function encodeBase64Url(value: object) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createDemoToken(user: User) {
  const now = Math.floor(Date.now() / 1000)
  return `${encodeBase64Url({ alg: 'HS256', typ: 'JWT' })}.${encodeBase64Url({ sub: user.id, email: user.email, iat: now, exp: now + 86400 })}.frontend-demo-signature`
}

function parseDemoToken(token: string) {
  try {
    const [headerPart, payloadPart, signature] = token.split('.')
    if (!headerPart || !payloadPart || signature !== 'frontend-demo-signature') return null
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const payload = JSON.parse(decodeURIComponent(escape(atob(normalized)))) as { sub?: string; exp?: number }
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function publicUser(user: StoredUser): User {
  const { passwordHash: _passwordHash, ...safeUser } = user
  return safeUser
}

function requireUser(): StoredUser {
  const token = localStorage.getItem(KEYS.token)
  const userId = localStorage.getItem(KEYS.currentUserId)
  if (!token || !userId) throw new ApiError(401, 'Сессия истекла. Войдите снова.')
  const payload = parseDemoToken(token)
  if (!payload || payload.sub !== userId) throw new ApiError(401, 'Токен недействителен. Войдите снова.')
  const user = readList<StoredUser>(KEYS.users).find((item) => item.id === userId)
  if (!user) throw new ApiError(401, 'Пользователь не найден.')
  return user
}

export const frontendApi = {
  async register(payload: { name: string; email: string; password: string }): Promise<{ user: User; accessToken: string }> {
    await delay()
    const name = payload.name.trim()
    const email = payload.email.trim().toLowerCase()
    if (name.length < 2) throw new ApiError(422, 'Имя должно содержать не менее 2 символов.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(422, 'Введите корректный email.')
    if (payload.password.length < 8 || !/[A-ZА-Я]/.test(payload.password) || !/[a-zа-я]/.test(payload.password) || !/\d/.test(payload.password)) {
      throw new ApiError(422, 'Пароль должен содержать минимум 8 символов, заглавную и строчную буквы и цифру.')
    }
    const users = readList<StoredUser>(KEYS.users)
    if (users.some((user) => user.email === email)) throw new ApiError(409, 'Пользователь с таким email уже зарегистрирован.')
    const user: StoredUser = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: await hashPassword(payload.password),
      createdAt: new Date().toISOString(),
    }
    users.push(user)
    writeList(KEYS.users, users)
    const token = createDemoToken(user)
    localStorage.setItem(KEYS.token, token)
    localStorage.setItem(KEYS.currentUserId, user.id)
    return { user: publicUser(user), accessToken: token }
  },

  async login(payload: { email: string; password: string }): Promise<{ user: User; accessToken: string }> {
    await delay()
    const email = payload.email.trim().toLowerCase()
    const passwordHash = await hashPassword(payload.password)
    const user = readList<StoredUser>(KEYS.users).find((item) => item.email === email)
    if (!user || user.passwordHash !== passwordHash) throw new ApiError(401, 'Неверный email или пароль.')
    const token = createDemoToken(user)
    localStorage.setItem(KEYS.token, token)
    localStorage.setItem(KEYS.currentUserId, user.id)
    return { user: publicUser(user), accessToken: token }
  },

  logout() {
    localStorage.removeItem(KEYS.token)
    localStorage.removeItem(KEYS.currentUserId)
  },

  getAccessToken() {
    return localStorage.getItem(KEYS.token)
  },

  async getProfile(): Promise<User> {
    await delay(80)
    return publicUser(requireUser())
  },

  async listTrips(): Promise<TripRecord[]> {
    await delay()
    const user = requireUser()
    return readList<TripRecord>(KEYS.trips)
      .filter((trip) => trip.ownerId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async createTrip(payload: CreateTripPayload): Promise<TripRecord> {
    await delay()
    const user = requireUser()
    if (payload.name.trim().length < 2) throw new ApiError(422, 'Укажите название поездки.')
    if (payload.destination.trim().length < 2) throw new ApiError(422, 'Укажите город или страну назначения.')
    if (!payload.startDate || !payload.endDate) throw new ApiError(422, 'Укажите даты поездки.')
    if (payload.endDate < payload.startDate) throw new ApiError(422, 'Дата окончания не может быть раньше даты начала.')
    if (!Number.isFinite(payload.budget) || payload.budget <= 0) throw new ApiError(422, 'Бюджет должен быть больше нуля.')
    const trip: TripRecord = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      name: payload.name.trim(),
      destination: payload.destination.trim(),
      startDate: payload.startDate,
      endDate: payload.endDate,
      budget: payload.budget,
      status: 'planned',
      createdAt: new Date().toISOString(),
    }
    const trips = readList<TripRecord>(KEYS.trips)
    trips.push(trip)
    writeList(KEYS.trips, trips)
    return trip
  },

  async getTrip(id: string): Promise<TripRecord> {
    await delay()
    const user = requireUser()
    const trip = readList<TripRecord>(KEYS.trips).find((item) => item.id === id)
    if (!trip) throw new ApiError(404, 'Поездка не найдена.')
    if (trip.ownerId !== user.id) throw new ApiError(403, 'У вас нет доступа к этой поездке.')
    return trip
  },
}
