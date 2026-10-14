const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1'

// это то, какие поля приходят с API. поля немного разные но это норм, пусть будет так
type BackendUser = {
  id: string
  name: string
  email: string
  created_at: string
}

type BackendTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

type BackendError = {
  detail?: string | {msg?:string}[]
}



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


async function refreshAccessToken(): Promise<string> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok)
  {
    localStorage.removeItem(KEYS.token)
    localStorage.removeItem(KEYS.currentUserId)

    throw new ApiError(response.status,'Сессия завершилась. Войдите снова.')
  }

  const data = await response.json() as BackendTokenResponse
  localStorage.setItem(KEYS.token, data.access_token)
  return data.access_token
}

async function authFetch(
  url: string,
  options: RequestInit = {}): Promise<Response> {
    let token = localStorage.getItem(KEYS.token)
    if (!token)
    {
      throw new ApiError(401, 'Вы не авторизованы.')
    }

  const makeRequest = (accessToken: string) => {
      const headers = new Headers(options.headers)
      headers.set('Authorization', `Bearer ${accessToken}`)
      return fetch(url, {...options, headers})
  }
  let response = await makeRequest(token)
  if (response.status !== 401)
  {
    return response
  }
  token = await refreshAccessToken()
  response = await makeRequest(token)
  return response
}

export const frontendApi = {
  //todo: CHANGED
  async register(
    payload: { name: string; email: string; password: string }
  ): Promise<User> {
    const name = payload.name.trim()
    const email = payload.email.trim().toLowerCase()
    const password = payload.password

    if (name.length < 2)
    {
      throw new ApiError(422, 'Имя должно быть не менее 2 символов.')
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      {
        throw new ApiError(422, 'Введите корректный email.')
      }
    if (password.length < 8 ||
       !/[A-ZА-Я]/.test(password) ||
        !/[a-zа-я]/.test(password) ||
         !/\d/.test(password)) 
    {
      throw new ApiError(422, 
        'Пароль должен содержать минимум 8 символов, заглавную и строчную буквы и цифру.')
    }

    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type' : 'application/json'
      },
      body: JSON.stringify({
        name, email, password
      })
    })
    const data = await response.json() as BackendUser | BackendError

    if (!response.ok)
    {
      const errorData = data as BackendError
      let message = 'Не удалось зарегистрироваться.'

      if (typeof errorData.detail === 'string')
      {
        message = errorData.detail
      } else if (Array.isArray(errorData.detail))
      {
        message = errorData.detail
                  .map((item) => item.msg)
                  .filter(Boolean)
                  .join(' ')
      }
      throw new ApiError(response.status, message)
    }

    const user = data as BackendUser
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at
    }
  },

  //todo: CHANGED
async login(payload: {email: string; password: string}): Promise<{ user: User; accessToken: string }> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-type' : 'application/json'
    },
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      password: payload.password
    })
  })
  const data = await response.json() as BackendTokenResponse | BackendError

  if (!response.ok)
  {
    const errorData = data as BackendError
    let message = 'Неверный email или пароль.'
    if (typeof errorData.detail == 'string')
    {
        message = errorData.detail
    } 
    else if (Array.isArray(errorData.detail))
    {
        message = errorData.detail
          .map((item)=> item.msg)
          .filter(Boolean)
          .join(' ')
    }
    throw new ApiError(response.status, message)
  }
  const authData = data as BackendTokenResponse
  const accessToken = authData.access_token

  localStorage.setItem(KEYS.token, accessToken)
  const profileResponse = await fetch(`${API_URL}/users/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  const profileData = await profileResponse.json() as BackendUser | BackendError

  if (!profileResponse.ok)
  {
    localStorage.removeItem(KEYS.token)
    throw new ApiError(profileResponse.status,
                      'Не удалось получить данные пользователя')
  }

  const backendUser = profileData as BackendUser
  const user: User = {
    id: backendUser.id,
    name: backendUser.name,
    email: backendUser.email,
    createdAt: backendUser.created_at
  }
  localStorage.setItem(KEYS.currentUserId, user.id)
  return {
    user,
    accessToken
  }
},

  //todo: CHANGED
  async logout(): Promise<void> {
    const token = localStorage.getItem(KEYS.token)

    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: token
        ? {
          Authorization: `Bearer ${token}`
        } : {}
      })
      if (!response.ok && response.status !== 401)
      {
        throw new ApiError(response.status,'Не удалось завершить сессию.')
      } 
    } finally {
        localStorage.removeItem(KEYS.token)
        localStorage.removeItem(KEYS.currentUserId)
    }
  },

  getAccessToken() {
    return localStorage.getItem(KEYS.token)
  },


  //todo: CHANGED
  async getProfile(): Promise<User> {
    const response = await authFetch(`${API_URL}/users/me`)

    const data = await response.json() as BackendUser | BackendError

    if (!response.ok)
    {
      throw new ApiError(response.status, 'Не удалось получить данные пользователя.')
    }

    const backendUser = data as BackendUser
    return {
      id: backendUser.id,
      name: backendUser.name,
      email: backendUser.email,
      createdAt: backendUser.created_at
    }
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
