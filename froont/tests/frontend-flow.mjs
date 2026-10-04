globalThis.window = globalThis

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
}

const { frontendApi, ApiError } = await import('../src/services/frontendApi.ts')
const email = `test-${Date.now()}@routea.local`
const password = 'Routea123'

await frontendApi.register({ name: 'Тестовый Пользователь', email, password })
frontendApi.logout()

const auth = await frontendApi.login({ email, password })
const profile = await frontendApi.getProfile()
const trip = await frontendApi.createTrip({
  name: 'Тестовая поездка',
  destination: 'Казань, Россия',
  startDate: '2026-11-01',
  endDate: '2026-11-05',
  budget: 85000,
})
const trips = await frontendApi.listTrips()
const details = await frontendApi.getTrip(trip.id)

let foreignTripProtected = false
frontendApi.logout()
await frontendApi.register({ name: 'Другой Пользователь', email: `other-${email}`, password })
try {
  await frontendApi.getTrip(trip.id)
} catch (error) {
  foreignTripProtected = error instanceof ApiError && error.status === 403
}

const checks = {
  jwtIssued: Boolean(auth.accessToken),
  profileBelongsToUser: profile.email === email,
  tripAppearsInList: trips.some((item) => item.id === trip.id),
  tripDetailsOpen: details.id === trip.id,
  foreignTripProtected,
}

if (Object.values(checks).some((value) => !value)) {
  console.error('Frontend flow failed:', checks)
  process.exit(1)
}

console.log('Frontend flow passed:', checks)
