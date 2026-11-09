import os
import uuid
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
import pandas as pd

from core.scraper_engine import ScraperEngine
from core.excel_styler import ExcelStyler
from core.pdf_engine import PDFExtractor

app = FastAPI(
    title="DataForge Studio API",
    version="2.6.0",
    description="Executive Web Scraping, Business Lead Generation & PDF Invoice Automation Suite"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")
UI_DIR = os.path.join(BASE_DIR, "ui")

os.makedirs(EXPORTS_DIR, exist_ok=True)
os.makedirs(UI_DIR, exist_ok=True)

scraper = ScraperEngine()

FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="20" fill="#7C3AED"/>
<circle cx="35" cy="45" r="8" fill="#FFFFFF"/>
<circle cx="65" cy="45" r="8" fill="#FFFFFF"/>
<path d="M30 68 Q50 82 70 68" stroke="#FFFFFF" stroke-width="6" fill="none" stroke-linecap="round"/>
</svg>"""

class ScrapeRequest(BaseModel):
    url: str
    mode: Optional[str] = "smart"
    max_items: Optional[int] = 50

@app.get("/")
async def root():
    index_file = os.path.join(UI_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "DataForge Studio Engine Online. Place index.html in /ui directory."}

# ================= PWA ASSETS & SERVICE WORKER ROUTES =================
@app.get("/manifest.json")
async def get_manifest():
    path = os.path.join(UI_DIR, "manifest.json")
    if os.path.exists(path):
        return FileResponse(path, media_type="application/manifest+json")
    raise HTTPException(status_code=404, detail="manifest.json not found")

@app.get("/sw.js")
async def get_service_worker():
    path = os.path.join(UI_DIR, "sw.js")
    if os.path.exists(path):
        return FileResponse(path, media_type="application/javascript", headers={"Service-Worker-Allowed": "/"})
    raise HTTPException(status_code=404, detail="sw.js not found")

@app.get("/icon-192.png")
async def get_icon_192():
    path = os.path.join(UI_DIR, "icon-192.png")
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    raise HTTPException(status_code=404, detail="icon-192.png not found")

@app.get("/icon-512.png")
async def get_icon_512():
    path = os.path.join(UI_DIR, "icon-512.png")
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    raise HTTPException(status_code=404, detail="icon-512.png not found")

@app.get("/icon.svg")
async def get_icon_svg():
    path = os.path.join(UI_DIR, "icon.svg")
    if os.path.exists(path):
        return FileResponse(path, media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="icon.svg not found")

@app.get("/favicon.ico")
async def favicon():
    return Response(content=FAVICON_SVG, media_type="image/svg+xml")

# ================= EXTRACTION & AUTOMATION ENDPOINTS =================
@app.post("/api/scrape")
async def trigger_scrape(req: ScrapeRequest):
    if not req.url.startswith("http://") and not req.url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid URL. Must begin with http:// or https://")

    try:
        data = scraper.smart_scrape(req.url, mode=req.mode or "smart", max_items=req.max_items or 50)

        if not data:
            return {
                "success": False,
                "message": "No structured items found. Target site may require JavaScript rendering or is blocking requests.",
                "count": 0,
                "data": []
            }

        df = pd.DataFrame(data)
        file_id = f"extract_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        excel_filename = f"{file_id}.xlsx"
        csv_filename = f"{file_id}.csv"

        excel_path = os.path.join(EXPORTS_DIR, excel_filename)
        csv_path = os.path.join(EXPORTS_DIR, csv_filename)

        sheet_title = "CRM Business Leads" if req.mode == "leads" else "Scraped Products & Prices"
        ExcelStyler.export_styled_excel(df, excel_path, sheet_name=sheet_title)
        df.to_csv(csv_path, index=False)

        return {
            "success": True,
            "count": len(data),
            "columns": list(df.columns),
            "data": data,
            "downloads": {
                "excel": f"/api/download/{excel_filename}",
                "csv": f"/api/download/{csv_filename}"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported")

    temp_path = os.path.join(EXPORTS_DIR, f"temp_{uuid.uuid4().hex[:8]}.pdf")
    try:
        with open(temp_path, "wb") as buffer:
            buffer.write(await file.read())

        result = PDFExtractor.extract_tables_and_metadata(temp_path)

        df = result["dataframe"]
        file_id = f"pdf_extracted_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        excel_filename = f"{file_id}.xlsx"
        csv_filename = f"{file_id}.csv"

        excel_path = os.path.join(EXPORTS_DIR, excel_filename)
        csv_path = os.path.join(EXPORTS_DIR, csv_filename)

        ExcelStyler.export_styled_excel(df, excel_path, sheet_name="Invoice Data")
        df.to_csv(csv_path, index=False)

        return {
            "success": True,
            "metadata": result["metadata"],
            "count": len(df),
            "columns": list(df.columns),
            "data": df.to_dict(orient="records"),
            "downloads": {
                "excel": f"/api/download/{excel_filename}",
                "csv": f"/api/download/{csv_filename}"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.get("/api/demo-leads")
async def get_demo_leads():
    """Demo endpoint for Project 3: Business Lead Scraper"""
    leads = scraper._generate_lead_sample("yellowpages.com", "https://www.yellowpages.com/search?search_terms=lawyers&geo_location_terms=San+Francisco%2C+CA", 8)
    df = pd.DataFrame(leads)
    file_id = f"crm_leads_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    excel_filename = f"{file_id}.xlsx"
    csv_filename = f"{file_id}.csv"

    excel_path = os.path.join(EXPORTS_DIR, excel_filename)
    csv_path = os.path.join(EXPORTS_DIR, csv_filename)

    ExcelStyler.export_styled_excel(df, excel_path, sheet_name="CRM Leads")
    df.to_csv(csv_path, index=False)

    return {
        "success": True,
        "count": len(leads),
        "columns": list(df.columns),
        "data": leads,
        "downloads": {
            "excel": f"/api/download/{excel_filename}",
            "csv": f"/api/download/{csv_filename}"
        }
    }

@app.get("/api/demo-invoice")
async def get_demo_invoice():
    """Demo endpoint for Project 2: PDF Invoice / Receipt Data Extractor"""
    invoice_rows = [
        {"#": 1, "Item Description": "Cloud Cluster Hosting (Q4)", "Qty": 1, "Unit Price": "$450.00", "Total": "$450.00"},
        {"#": 2, "Item Description": "Automated Web Scraper Pipeline Maintenance", "Qty": 10, "Unit Price": "$65.00", "Total": "$650.00"},
        {"#": 3, "Item Description": "Custom openpyxl Executive Styling Template", "Qty": 1, "Unit Price": "$250.00", "Total": "$250.00"},
        {"#": 4, "Item Description": "SSL Security Certificate & Proxy Pool", "Qty": 1, "Unit Price": "$100.00", "Total": "$100.00"}
    ]
    metadata = {
        "Invoice_Number": "INV-2026-8819",
        "Date": datetime.now().strftime("%Y-%m-%d"),
        "Vendor": "DataForge Enterprise Systems Inc.",
        "Total_Amount": "$1,450.00",
        "Tax_Amount": "$116.00",
        "Vendor_Email": "billing@dataforge-enterprise.com",
        "Total_Pages": 1
    }
    df = pd.DataFrame(invoice_rows)
    file_id = f"invoice_demo_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    excel_filename = f"{file_id}.xlsx"
    csv_filename = f"{file_id}.csv"

    excel_path = os.path.join(EXPORTS_DIR, excel_filename)
    csv_path = os.path.join(EXPORTS_DIR, csv_filename)

    ExcelStyler.export_styled_excel(df, excel_path, sheet_name="Invoice Summary")
    df.to_csv(csv_path, index=False)

    return {
        "success": True,
        "metadata": metadata,
        "count": len(invoice_rows),
        "columns": list(df.columns),
        "data": invoice_rows,
        "downloads": {
            "excel": f"/api/download/{excel_filename}",
            "csv": f"/api/download/{csv_filename}"
        }
    }

@app.get("/api/demo-data")
async def get_demo_data():
    """Demo endpoint for Project 1: E-Commerce Product & Price Tracker"""
    sample = [
        {"#": 1, "Title": "A Light in the Attic", "Price": "£51.77", "Rating_Or_Tag": "Three", "Availability": "In stock", "Product_URL": "https://books.toscrape.com/", "Image_URL": "https://books.toscrape.com/media/cache/2c/da/2cdad67c44b002e7ead0cc35693c0e8b.jpg"},
        {"#": 2, "Title": "Tipping the Velvet", "Price": "£53.74", "Rating_Or_Tag": "One", "Availability": "In stock", "Product_URL": "https://books.toscrape.com/", "Image_URL": "https://books.toscrape.com/media/cache/26/0c/260c6ae16bce31c8f8c95daddd9f4a1c.jpg"},
        {"#": 3, "Title": "Soumission", "Price": "£50.10", "Rating_Or_Tag": "One", "Availability": "In stock", "Product_URL": "https://books.toscrape.com/", "Image_URL": "https://books.toscrape.com/media/cache/3e/ef/3eef99c9d9e431a3e9e97dd20f4f7045.jpg"}
    ]
    df = pd.DataFrame(sample)
    file_id = f"demo_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    excel_filename = f"{file_id}.xlsx"
    csv_filename = f"{file_id}.csv"

    excel_path = os.path.join(EXPORTS_DIR, excel_filename)
    csv_path = os.path.join(EXPORTS_DIR, csv_filename)

    ExcelStyler.export_styled_excel(df, excel_path, sheet_name="Demo Products")
    df.to_csv(csv_path, index=False)

    return {
        "success": True,
        "count": len(sample),
        "columns": list(df.columns),
        "data": sample,
        "downloads": {
            "excel": f"/api/download/{excel_filename}",
            "csv": f"/api/download/{csv_filename}"
        }
    }

@app.get("/api/download/{filename}")
async def download_file(filename: str):
    file_path = os.path.join(EXPORTS_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/octet-stream"
        )
    raise HTTPException(status_code=404, detail="File not found or expired")

app.mount("/static", StaticFiles(directory=UI_DIR), name="static")
