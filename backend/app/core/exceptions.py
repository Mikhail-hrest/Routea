class UserAlreadyExistError(Exception):
    pass

class InvalidCredentialsError(Exception):
    pass

class UserBlockedError(Exception):
    pass

class InvalidRefreshTokenError(Exception):
    pass
class TripNotFoundError(Exception):
    pass

class InvalidTripDatesError(Exception):
    pass


class TripDayNotFoundError(Exception):
    pass


class InvalidTripDayDateError(Exception):
    pass


class DuplicateTripDayError(Exception):
    pass


class TripDaysOutsideRangeError(Exception):
    pass


class PlaceNotFoundError(Exception):
    pass


class PlaceOrderConflictError(Exception):
    pass
