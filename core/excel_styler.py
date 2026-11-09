import os
import re
from datetime import datetime
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

class ExcelStyler:
    """
    Transforms raw scraped dataframes into executive-grade,
    styled Excel spreadsheets ready to deliver to paying clients.
    Guarantees compliance with openpyxl constraints (31-char sheet names, non-empty columns).
    """

    HEADER_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")  # Slate 800
    HEADER_FONT = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    ZEBRA_FILL = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")   # Slate 50
    DATA_FONT = Font(name="Segoe UI", size=10, color="0F172A")
    BORDER_SIDE = Side(border_style="thin", color="E2E8F0")
    CELL_BORDER = Border(left=BORDER_SIDE, right=BORDER_SIDE, top=BORDER_SIDE, bottom=BORDER_SIDE)

    @classmethod
    def export_styled_excel(cls, df: pd.DataFrame, output_path: str, sheet_name: str = "Extracted Data") -> str:
        """Saves a pandas DataFrame with executive styling, auto-filter, and fitted columns."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Enforce openpyxl 31-char sheet name limit and remove invalid characters
        clean_sheet_name = re.sub(r'[\[\]\*\?\/\\:]', '_', str(sheet_name).strip())[:31] or "Extracted Data"

        # Ensure DataFrame has at least one column
        if df.empty or len(df.columns) == 0:
            df = pd.DataFrame([{"Status": "No records extracted"}])

        # 1. Write raw data to Excel via openpyxl engine
        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name=clean_sheet_name, index=False)
            workbook = writer.book
            worksheet = writer.sheets[clean_sheet_name]

            # 2. Freeze the header row
            worksheet.freeze_panes = "A2"

            # 3. Style Header Row
            for col_idx in range(1, len(df.columns) + 1):
                cell = worksheet.cell(row=1, column=col_idx)
                cell.fill = cls.HEADER_FILL
                cell.font = cls.HEADER_FONT
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                cell.border = cls.CELL_BORDER
                worksheet.row_dimensions[1].height = 28

            # 4. Style Data Rows (Zebra Striping + Borders)
            for row_idx in range(2, len(df) + 2):
                is_even = (row_idx % 2 == 0)
                worksheet.row_dimensions[row_idx].height = 22
                for col_idx in range(1, len(df.columns) + 1):
                    cell = worksheet.cell(row=row_idx, column=col_idx)
                    cell.font = cls.DATA_FONT
                    cell.border = cls.CELL_BORDER
                    cell.alignment = Alignment(vertical="center")
                    if is_even:
                        cell.fill = cls.ZEBRA_FILL

            # 5. Enable Auto-Filter
            worksheet.auto_filter.ref = worksheet.dimensions

            # 6. Auto-fit column widths with dynamic padding
            for col in worksheet.columns:
                max_len = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col:
                    val_str = str(cell.value or "")
                    if len(val_str) > max_len:
                        max_len = len(val_str)
                # Apply comfortable width clamp
                adjusted_width = max(max_len + 4, 12)
                worksheet.column_dimensions[col_letter].width = min(adjusted_width, 60)

        return output_path
