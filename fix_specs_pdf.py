#!/usr/bin/env python3
"""
Quick script to extract text from the broken specifications PDF
and update the database with proper content
"""

import pdfplumber
import json
import psycopg2
import os
from pathlib import Path

def extract_specifications_pdf():
    """Extract text from the specifications PDF using pdfplumber"""
    pdf_path = "uploads/1755967887385_b8fa8c0dc62e7754_Specifications_R1_1_May_21.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"❌ PDF file not found: {pdf_path}")
        return None
        
    print(f"📄 Processing PDF: {pdf_path}")
    print(f"📊 File size: {os.path.getsize(pdf_path) / (1024*1024):.1f} MB")
    
    all_text = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            print(f"📑 Total pages: {len(pdf.pages)}")
            
            for i, page in enumerate(pdf.pages):
                print(f"🔄 Processing page {i+1}/{len(pdf.pages)}", end="\r")
                
                text = page.extract_text()
                if text and text.strip():
                    all_text.append(text.strip())
                    
            print(f"\n✅ Extraction complete!")
            
        full_text = "\n\n".join(all_text)
        
        print(f"📊 Extraction results:")
        print(f"   - Pages processed: {len(pdf.pages)}")
        print(f"   - Pages with text: {len(all_text)}")
        print(f"   - Total characters: {len(full_text):,}")
        print(f"   - Text preview: {full_text[:200]}...")
        
        return {
            "textContent": full_text,
            "pageCount": len(pdf.pages),
            "pagesWithText": len(all_text)
        }
        
    except Exception as e:
        print(f"❌ Extraction failed: {e}")
        return None

def update_database(extracted_data):
    """Update the document in the database with extracted content"""
    document_id = "6c8647ba-822a-4098-9d25-cc6f27b4d608"
    
    try:
        # Connect to database using environment variables
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor()
        
        # Update the document
        cursor.execute("""
            UPDATE documents 
            SET 
                textContent = %s,
                pageCount = %s,
                analysisStatus = 'Ready',
                processingNotes = %s
            WHERE id = %s
        """, (
            extracted_data["textContent"],
            extracted_data["pageCount"],
            f"Fixed with Python pdfplumber. Pages: {extracted_data['pageCount']}, Characters: {len(extracted_data['textContent']):,}",
            document_id
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Database updated successfully for document {document_id}")
        return True
        
    except Exception as e:
        print(f"❌ Database update failed: {e}")
        return False

if __name__ == "__main__":
    print("🔧 Fixing broken specifications PDF extraction...")
    
    # Extract PDF content
    extracted_data = extract_specifications_pdf()
    
    if extracted_data and extracted_data["textContent"]:
        print("\n📊 Extraction successful!")
        
        # Update database
        if update_database(extracted_data):
            print("\n🎯 SUCCESS! Specifications document has been fixed.")
            print(f"   - Original text length: 724 characters")
            print(f"   - New text length: {len(extracted_data['textContent']):,} characters")
            print(f"   - Page count: {extracted_data['pageCount']}")
            print("\n🚀 Ready for comprehensive Claude analysis!")
        else:
            print("\n❌ Failed to update database")
    else:
        print("\n❌ Failed to extract PDF content")