import asyncio
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.crud.hr_staff import export_staff_rows
from app.api.routes.hr_agent import _parse_spreadsheet
from app.api.routes.hr_staff import export
from fastapi import Request
from starlette.datastructures import URL
import io

def test():
    db = SessionLocal()
    # Mock request
    class MockRequest:
        base_url = URL("http://localhost:8000")
    
    res = export(MockRequest(), db, format="xlsx")
    data = res.body
    
    parsed = _parse_spreadsheet(data, "export.xlsx")
    print("Headers:", parsed["headers"])
    if parsed["rows"]:
        print("First row keys:", list(parsed["rows"][0].keys()))
        print("First row ID:", parsed["rows"][0].get("ID"))
        print("First row Full Name:", parsed["rows"][0].get("Full Name"))
    else:
        print("No rows found!")

test()
