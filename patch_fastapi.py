import os

main_file = "backend/app/main.py"
with open(main_file, "r") as f:
    content = f.read()

if "from fastapi.responses import JSONResponse" not in content:
    content = content.replace("from fastapi import FastAPI", "from fastapi import FastAPI, Request\nfrom fastapi.responses import JSONResponse\nimport traceback")
    
    exception_handler = """
@app.exception_handler(Exception)
async def custom_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": str(exc), "traceback": traceback.format_exc()}
    )
"""
    content += exception_handler
    
    with open(main_file, "w") as f:
        f.write(content)
