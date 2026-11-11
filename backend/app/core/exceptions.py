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
