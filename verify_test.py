import sys
import os
import pandas as pd

root_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, root_dir)

from core.excel_styler import ExcelStyler
from core.scraper_engine import ScraperEngine

print("[Test 1] Testing ExcelStyler...")
df = pd.DataFrame([
    {"Product": "Laptop", "Price": "$999.00", "Rating": "5 Stars", "Status": "In Stock"},
    {"Product": "Mouse", "Price": "$25.00", "Rating": "4 Stars", "Status": "In Stock"},
])
out_excel = os.path.join(root_dir, "exports", "test_out.xlsx")
ExcelStyler.export_styled_excel(df, out_excel)
assert os.path.exists(out_excel), "Excel export failed!"
print(" -> Excel export verified successfully!")

print("[Test 2] Testing ScraperEngine import & User-Agent rotation...")
engine = ScraperEngine()
headers = engine._get_headers()
assert "User-Agent" in headers, "Headers failed!"
print(" -> ScraperEngine verified successfully!")

print("\nAll systems operational! Ready to launch.")
