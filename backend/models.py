from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)


class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    description = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SolvedTicket(Base):
    __tablename__ = "solved_tickets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    description = Column(String, nullable=False)
    ai_answer = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ManualReviewTicket(Base):
    __tablename__ = "manual_review_tickets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    description = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
