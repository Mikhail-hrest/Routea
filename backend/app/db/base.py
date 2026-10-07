from sqlalchemy.orm import DeclarativeBase

# нужен для указания что дочерние классы принадлежать одной orm системе, а не каждая отдельная orm
class Base(DeclarativeBase):
    pass