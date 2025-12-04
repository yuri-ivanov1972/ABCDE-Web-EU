# ABCDE.lv - Healthy Food Product Browser

## Overview

ABCDE.lv is a web application designed to empower users to make healthier food choices by providing transparent nutritional information for products from Rimi supermarket. The platform enables product search, category browsing, nutritional filtering based on Nutri-Score, and displays detailed product information. It aims to improve public health awareness regarding food consumption.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Technology Stack**: React with TypeScript, Vite for tooling, Tailwind CSS with shadcn/ui for UI, Wouter for routing, and TanStack Query for data fetching.
- **Design Principles**: Mobile-First Design ensuring responsiveness across devices.
- **Internationalization**: Comprehensive i18n support using `react-i18next` with URL-based language routing (`/lv`, `/en`).
- **Mobile Camera Scanner**: A mobile-only feature for scanning product price tags, capturing images, and utilizing OCR for text extraction.

### Backend
- **Technology Stack**: Express.js with TypeScript.
- **API Design**: RESTful API with endpoints for products (search, filtering, pagination) and categories (hierarchical browsing).
- **Data Processing**: SQL-level operations for filtering and sorting to ensure scalability and performance.
- **Authentication**: Basic session-based user management for future extensibility.
- **OCR and Product Recognition**: Integrates with Google Cloud Vision API for OCR, followed by a two-pass token matching algorithm to identify products from scanned text, normalizing Latvian characters for accuracy.
- **Scan Photo Storage**: Backend-only storage of scanned price tag photos and associated metadata using Replit App Storage, with a 30-day retention policy and automatic cleanup.

### Data Storage
- **Databases**: PostgreSQL with two database connections:
  - **Rimi Database** (RIMI_DATABASE_URL): Remote Neon Database for categories, products, nutrition facts, and product photos (consolidated production database from RimiScraper v2)
  - **Scans Database** (DATABASE_URL): Local Replit PostgreSQL for scan data (user scans, OCR results, photos)
- **ORM**: Drizzle ORM for database interactions and migrations.
- **Database Clients**: `rimiDb` for all product/category operations, `scansDb` for local scan data
- **Schema Design**: Normalized hierarchical category structure, detailed product information including SKU, names, URLs, quantities, comprehensive nutrition facts with Nutri-Score calculations, and scan metadata with UUID-based photo access tokens.
- **Note**: The remote database contains additional columns (country_of_origin, nutrition_source, needs_enrichment, etc.) that are safely ignored by the application schema.

### UI/UX
- **Component Libraries**: Radix UI for accessible components, Lucide React for icons.
- **Form Management**: React Hook Form for robust form handling.
- **Analytics**: Integrated Google Analytics (GA4) and Google Tag Manager (GTM) with custom event tracking for user interactions, including product scans, petition link clicks, and camera permissions.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting.

### Cloud Services
- **Google Cloud Vision API**: Used for OCR (TEXT_DETECTION) in the mobile scanner feature.

### Frontend Libraries
- **Radix UI**: Component primitives.
- **Lucide React**: Icon library.
- **React Hook Form**: Form management.
- **Date-fns**: Date utilities.
- **react-i18next**: Internationalization framework.

### Analytics & Tag Management
- **Google Analytics (GA4)**
- **Google Tag Manager**

### Development Tools
- **Vite**: Build tool.
- **ESBuild**: JavaScript bundler.
- **PostCSS + Autoprefixer**: CSS processing.
- **TypeScript Compiler**: Type checking.
- **Drizzle Kit**: Database migration and schema management.