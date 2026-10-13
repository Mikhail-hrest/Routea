class UserAlreadyExistError(Exception):
    pass

class InvalidCredentialsError(Exception):
    pass

class UserBlockedError(Exception):
    pass

class InvalidRefreshTokenError(Exception):
    pass