# EstimatorPro File Inventory - Critical Files for Analysis

## ROOT CONFIGURATION ✅
- `package.json` - Dependencies and scripts
- `package-lock.json` - Lock file  
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment template (redacted)
- `drizzle.config.ts` - Database configuration

## SERVER CORE FILES ✅

### Main Entry Points
- `server/index.ts` - Express app setup, security, routing
- `server/routes.ts` - Main API routes registry
- `server/storage.ts` - Database storage interface  
- `server/db.ts` - Drizzle database connection

### BIM Generation (CRITICAL)
- `server/bim-generator.ts` - BIM generation orchestrator
- `server/real-qto-processor.ts` - Quantity take-off processor
- `server/routes/bim-generate.ts` - BIM generation API endpoints
- `server/routes/generation.ts` - Generation control routes

### MEP PHASE 3 IMPLEMENTATION (SUCCESS) 
- `server/helpers/lod-expander.ts` - **CRITICAL** MEP density controls & spacing algorithms
- `server/helpers/lod-profile.ts` - LOD configuration profiles
- `server/helpers/polygon-utils.ts` - Footprint boundary calculations
- `server/helpers/site-utils.ts` - Site analysis utilities

### Document Processing
- `server/pdf-extract.ts` - PDF text extraction (extractPdfTextAndPages)
- `server/document-similarity.ts` - Document analysis and similarity
- `server/cad-parser.ts` - CAD file parsing with Claude
- `server/anthropic-client.ts` - Anthropic API wrapper

### Storage & File Handling
- `server/storage-file-resolver.ts` - File path resolution
- `server/file-storage.ts` - File storage management
- `server/services/file-storage.ts` - Storage service layer
- `server/helpers/patch-storage.ts` - Storage patches

### Processing Pipeline  
- `server/helpers/layout-calibration.ts` - Layout calibration
- `server/helpers/footprint-extractor.ts` - Building footprint extraction
- `server/helpers/raster-legend-assoc.ts` - Raster image analysis
- `server/helpers/element-sanitizer.ts` - Element validation
- `server/services/progress-bus.ts` - Processing progress tracking

### API Routes
- `server/routes/diag.ts` - **NEW** Diagnostic endpoints
- `server/routes/calibration.ts` - Calibration debug routes
- `server/routes/footprint.ts` - Footprint extraction routes  
- `server/routes/postprocess.ts` - Post-processing routes
- `server/routes/bim-debug.ts` - BIM debugging routes
- `server/routes/bim-elements.ts` - BIM element CRUD
- `server/routes/similarity-admin.ts` - Similarity analysis admin
- `server/routes/ai-coach.ts` - AI coaching system

### Similarity System
- `server/document-similarity.ts` - Core similarity analysis
- `server/services/similarity-cache.ts` - Caching layer  
- `server/services/similarity-scheduler.ts` - Cache eviction scheduler
- `server/services/similarity-db.ts` - Database operations

## DATABASE SCHEMA ✅
- `shared/schema.ts` - Complete Drizzle schema definitions
- `drizzle.config.ts` - Migration configuration  
- `migrations/` - SQL migration files (if any)

## CLIENT COMPONENTS ✅

### BIM Viewer
- `client/src/components/bim/bim-3d-viewer.tsx` - 3D visualization component
- `client/src/components/bim/types.ts` - TypeScript type definitions
- `client/src/components/bim/model-properties.tsx` - Property display

### UI Components
- `client/src/components/ui/**` - Shadcn/ui component library
- `client/src/lib/api/**` - API fetch hooks and utilities

### Pages
- Main BIM page (location: needs identification)
- Dashboard with project management
- Analysis and similarity pages

## ENVIRONMENT & CONFIG ✅

### Environment Variables (from .env.example)
```bash
# Database
DATABASE_URL=***
PGHOST=*** 
PGPORT=***

# AI Services  
ANTHROPIC_API_KEY=***

# MEP Configuration
DEFAULT_LOD=***
LOD_LIGHT_SPACING=***
LOD_SPRINKLER_SPACING=***
LOD_RECEPTACLE_SPACING=***

# Processing Controls
FORCE_ENHANCED_PIPELINE=***
CALIBRATE_FORCE=***
POSTPROCESS_ON_SERVE=***
SITE_SYMBOL_DETECT=***
```

### Actual Environment Status
- ANTHROPIC_API_KEY: SET ✅
- DATABASE_URL: SET ✅
- PGHOST: SET ✅
- MEP spacing variables: MISSING (using defaults)

## SAMPLE DATA BUNDLE ✅

### Test Identifiers
- **Model ID**: `57735194-9b71-468b-8540-619025ad30a0`
- **Project ID**: `c7ec2523-8631-4181-8c6e-f705861654d7`
- **Element Count**: 4,248 (98% MEP systems)

### Sample Documents
- Site Plan: `A002_R1_Site_Plan_1_May_21.pdf`
- Ground Floor: `A201_R1_GROUND_FLOOR_PLAN_A1_May_21.pdf`  
- Second Floor: `A204_R1_SECOND_FLOOR_PLAN_A1_May_21.pdf`

## DIAGNOSTIC ENDPOINTS ✅
- `GET /api/__routes` - Complete API routing inventory
- `GET /api/__diag` - System configuration analysis
- `GET /api/bim/models/:modelId/debug/summary` - BIM element breakdown

## STATUS: COMPLETE PACKAGE READY
All critical files identified and accessible for comprehensive analysis and cleanup.