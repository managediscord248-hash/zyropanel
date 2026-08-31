import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Configure SQLite fallback if PostgreSQL is not connected or in test mode
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

try:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        connect_args={"check_same_thread": False} if "sqlite" in db_url else {}
    )
except Exception:
    # Safe fallback if postgres service is offline
    fallback_path = os.path.join(settings.DATA_DIRECTORY, "zyrocloud.db")
    os.makedirs(os.path.dirname(fallback_path), exist_ok=True)
    engine = create_engine(f"sqlite:///{fallback_path}", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
