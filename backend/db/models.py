from datetime import datetime
from sqlalchemy import Column, Integer, String, BigInteger, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from db.database import Base

class FileRecord(Base):
    __tablename__ = "file_records"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String(4096), unique=True, index=True, nullable=False)
    filename = Column(String(255), index=True, nullable=False)
    file_size = Column(BigInteger, default=0)
    extension = Column(String(64), index=True, default="")
    mime_type = Column(String(128), default="")
    sha256_hash = Column(String(64), nullable=True)
    
    category = Column(String(64), index=True, default="Uncategorized")
    summary = Column(Text, nullable=True)
    enriched_data = Column(Text, nullable=True)
    status = Column(String(32), default="indexed", index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    actions = relationship("ActionItem", back_populates="file", cascade="all, delete-orphan")

class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("file_records.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String(32), nullable=False)
    source_path = Column(String(4096), nullable=False)
    target_path = Column(String(4096), nullable=False)
    category = Column(String(64), nullable=True)
    reasoning = Column(Text, nullable=True)
    status = Column(String(32), default="pending", index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    executed_at = Column(DateTime, nullable=True)

    file = relationship("FileRecord", back_populates="actions")

class SearxCache(Base):
    __tablename__ = "searx_cache"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String(1024), unique=True, index=True, nullable=False)
    results_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
