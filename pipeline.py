#!/usr/bin/env python3
"""
EstimatorPro - AI-Powered Construction Estimation Pipeline
Pipeline: PDF → Parse → AI Understanding → BoQ → BIM → Export
"""

import argparse
import json
import os
from pathlib import Path
from loguru import logger

from parser.pdf_parser import PDFParser
from ai.nlp_spec_extractor import NLPSpecExtractor
from ai.cv_drawing_extractor import CVDrawingExtractor
from boq.boq_generator import BoQGenerator
from bim.ifc_generator import IFCGenerator
from api.models import EstimationProject


def main():
    parser = argparse.ArgumentParser(description="EstimatorPro AI Pipeline")
    parser.add_argument("--pdf", required=True, help="Path to PDF file")
    parser.add_argument("--out", required=True, help="Output directory")
    parser.add_argument("--project-name", default="Untitled Project", help="Project name")
    parser.add_argument("--standards", choices=["CA", "US", "BOTH"], default="BOTH", 
                       help="Construction standards (CA=Canadian, US=American)")
    
    args = parser.parse_args()
    
    # Create output directory
    output_dir = Path(args.out)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Starting EstimatorPro pipeline for {args.pdf}")
    
    # Initialize project
    project = EstimationProject(
        name=args.project_name,
        standards=args.standards,
        input_file=args.pdf,
        output_dir=str(output_dir)
    )
    
    try:
        # Stage 1: PDF Parsing
        logger.info("Stage 1: Parsing PDF...")
        pdf_parser = PDFParser()
        parsed_data = pdf_parser.parse_pdf(args.pdf, output_dir / "01_parsed")
        project.parsed_data = parsed_data
        
        # Stage 2: AI Understanding
        logger.info("Stage 2: AI Analysis...")
        
        # NLP for specifications
        nlp_extractor = NLPSpecExtractor()
        spec_analysis = nlp_extractor.extract_specifications(
            parsed_data.text_content, 
            parsed_data.tables,
            standards=args.standards
        )
        project.spec_analysis = spec_analysis
        
        # Computer Vision for drawings
        cv_extractor = CVDrawingExtractor()
        drawing_analysis = cv_extractor.extract_components(
            parsed_data.images,
            output_dir / "02_cv_analysis"
        )
        project.drawing_analysis = drawing_analysis
        
        # Stage 3: BoQ Generation
        logger.info("Stage 3: Generating Bill of Quantities...")
        boq_generator = BoQGenerator()
        boq_data = boq_generator.generate_boq(
            spec_analysis, 
            drawing_analysis,
            standards=args.standards
        )
        project.boq_data = boq_data
        
        # Save BoQ as JSON and Excel
        boq_generator.save_boq(boq_data, output_dir / "03_boq")
        
        # Stage 4: BIM Model Generation
        logger.info("Stage 4: Generating BIM model...")
        ifc_generator = IFCGenerator()
        bim_model = ifc_generator.generate_ifc(
            drawing_analysis,
            boq_data,
            output_dir / "04_bim"
        )
        project.bim_model = bim_model
        
        # Stage 5: Save Project Summary
        logger.info("Stage 5: Saving project summary...")
        project_summary = {
            "project_name": project.name,
            "standards": project.standards,
            "total_value": boq_data.total_value,
            "line_items": len(boq_data.items),
            "compliance_checks": len(spec_analysis.compliance_results),
            "components_detected": len(drawing_analysis.components),
            "files_generated": {
                "boq_json": str(output_dir / "03_boq" / "boq.json"),
                "boq_excel": str(output_dir / "03_boq" / "boq.xlsx"),
                "ifc_model": str(output_dir / "04_bim" / "model.ifc"),
                "compliance_report": str(output_dir / "05_reports" / "compliance.json")
            }
        }
        
        with open(output_dir / "project_summary.json", "w") as f:
            json.dump(project_summary, f, indent=2, default=str)
        
        logger.success(f"Pipeline completed successfully! Output: {output_dir}")
        logger.info(f"Total project value: ${boq_data.total_value:,.2f}")
        logger.info(f"Components detected: {len(drawing_analysis.components)}")
        logger.info(f"BoQ line items: {len(boq_data.items)}")
        
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise


if __name__ == "__main__":
    main()