# app/core/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# In production, this comes from a .env file: 
# postgresql://[user]:[password]@[host]:[port]/[database_name]
# For local testing, you can leave it as sqlite or update to your local Postgres credentials
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./payroll.db")

engine = create_engine(
    DATABASE_URL,
    # check_same_thread is only needed for SQLite. We remove it for Postgres compatibility.
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()