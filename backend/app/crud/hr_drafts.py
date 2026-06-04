from sqlalchemy.orm import Session
from app.models.hr_draft import HRDraft

def get_draft(db: Session, draft_id: str) -> HRDraft | None:
    return db.query(HRDraft).filter(HRDraft.draft_id == draft_id).first()

def get_employee_drafts(db: Session, employee_id: str) -> list[HRDraft]:
    return db.query(HRDraft).filter(HRDraft.employee_id == employee_id).order_by(HRDraft.updated_at.desc()).all()

def create_draft(db: Session, draft: HRDraft) -> HRDraft:
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft

def update_draft(db: Session, draft: HRDraft) -> HRDraft:
    db.commit()
    db.refresh(draft)
    return draft

def delete_draft(db: Session, draft: HRDraft) -> None:
    db.delete(draft)
    db.commit()
