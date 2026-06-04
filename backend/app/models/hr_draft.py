from sqlalchemy import Column, Integer, String
from app.db.base import Base

class HRDraft(Base):
    __tablename__ = "hr_drafts"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, index=True, nullable=False)
    draft_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    document_key = Column(String, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    size = Column(Integer, default=0, nullable=False)
    content_type = Column(String)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
