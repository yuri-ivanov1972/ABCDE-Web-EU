# ABCDE.lv - Healthy Food Product Browser

## Overview

ABCDE.lv is a web application that helps users make healthier food choices by providing transparent nutritional information about products from Rimi supermarket. The platform features product search, category browsing, nutritional filtering based on Nutri-Score ratings, and detailed product information including ingredients and nutritional facts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React + TypeScript**: Modern React application built with TypeScript for type safety
- **Vite**: Fast development server and build tool with hot module replacement
- **Tailwind CSS + shadcn/ui**: Utility-first CSS framework with a comprehensive component library
- **Wouter**: Lightweight client-side routing solution
- **TanStack Query**: Robust data fetching and caching library for API interactions
- **Mobile-First Design**: Responsive design that works across all device sizes

### Backend Architecture  
- **Express.js**: Node.js web framework handling API requests and serving static files
- **TypeScript**: Full-stack TypeScript implementation for consistency
- **Multi-Database Setup**: Separate databases for categories and products data
- **RESTful API Design**: Clean API endpoints following REST conventions
- **Session Management**: Built-in session handling for user state

### Data Storage Solutions
- **PostgreSQL**: Primary database system using two separate instances
  - Categories Database: Hierarchical product category structure (3 levels)
  - Products Database: Product information, nutrition facts, and photos
- **Drizzle ORM**: Modern TypeScript ORM for database operations and migrations
- **Neon Database**: Serverless PostgreSQL hosting with WebSocket connections

### Database Schema Design
- **Normalized Categories**: Hierarchical structure with parent-child relationships
- **Product Information**: SKU, names, URLs, quantities with category associations
- **Nutrition Facts**: Complete nutritional data including Nutri-Score calculations
- **Product Photos**: Image storage with primary/secondary designation
- **Text Normalization**: Latvian character normalization for improved search functionality

### API Architecture
- **Product Endpoints**: Search, filtering, pagination with multiple sort options
- **Category Endpoints**: Hierarchical category browsing with path resolution
- **Filtering System**: Advanced filtering by Nutri-Score, nutrients (sugar, fat, protein, salt)
- **Search Functionality**: Text-based product search with Latvian language support
- **Pagination**: Efficient data loading with configurable page sizes

### Authentication and Authorization
- **User Management**: Basic user system (template structure maintained)
- **Session Storage**: Express sessions for user state management
- **Future-Ready**: Structure in place for user-specific features

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting for both categories and products
- **WebSocket Connections**: Real-time database connectivity via WebSockets

### Frontend Libraries
- **Radix UI**: Accessible component primitives for complex UI elements
- **Lucide React**: Icon library for consistent visual elements
- **React Hook Form**: Form handling with validation support
- **Date-fns**: Date manipulation and formatting utilities

### Development Tools
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS + Autoprefixer**: CSS processing and vendor prefixing
- **TypeScript Compiler**: Type checking and compilation
- **Drizzle Kit**: Database migration and schema management tools

### Analytics and Tracking
- **Google Analytics (GA4)**: User behavior tracking and site analytics (G-TLGL1PJYTC)
- **Google Tag Manager**: Tag and conversion tracking management (GTM-P46NQX5H)
- **Custom Event Tracking**: Centralized analytics utility for tracking user interactions
  - Product scan events (successful scans, OCR confidence)
  - Product view after scan (user engagement)
  - Petition link clicks (manabalss.lv initiative tracking)
  - Camera permission status (granted/denied)
  - Scan failure events (OCR errors, debugging data)

### Asset Management
- **SVG to ICO Conversion**: Favicon generation from vector graphics
- **Vite Asset Processing**: Optimized asset bundling and serving
- **Static File Serving**: Efficient delivery of images and other assets from client/public/ folder
- **Public Folder Structure**: Static files (robots.txt, favicon.ico) served from client/public/ directory

### Text Processing
- **Latvian Language Support**: Character normalization for diacritics and special characters
- **Search Optimization**: Text processing for improved product discovery

## Recent Changes

### Internationalization Implementation (September 2025) ✅ COMPLETED
- Added comprehensive internationalization (i18n) support using react-i18next
- Implemented URL-based language routing with `/lv` (Latvian, default) and `/en` (English) prefixes
- Created translation files with complete coverage across all components:
  - Common translations (loading states, navigation)
  - Header translations (tagline, search, language switcher)
  - Home page translations (product listings, sorting, filters)
  - Product page translations (details, nutrition facts, ingredients)
  - Category translations (navigation, breadcrumbs)
  - Filter translations (Nutri-Score, nutrients, active filters)
  - Pagination translations (navigation controls)
  - Error page translations (404, API errors)
- Established language detection and persistence using browser storage
- Implemented language-aware navigation components (LangLink, LanguageRouter)
- Set up lazy loading for translation resources with loading states
- Category localization supports both Latvian names (primary) and English names (fallback)
- Complete routing system supports language-prefixed URLs for all pages
- **CRITICAL FIX**: Resolved ProductDetails 404 routing issue by replacing LanguageAwareRoute abstraction with explicit route definitions and removing problematic catch-all routes
- **VERIFIED WORKING**: Full internationalization workflow confirmed functional - routing, translations, product pages, and language switching all operational

### Filtering and Sorting Architecture Improvements (September 2025) ✅ COMPLETED
- **Fixed Fundamental Architecture Issue**: Resolved critical problem where filters and sorting only applied to current page (12 products) instead of entire dataset (8460 products)
- **Migrated to SQL-Level Operations**: Complete rewrite of product filtering and sorting logic from JavaScript memory operations to database-level SQL queries
- **Database Query Optimization**: Implemented proper JOIN queries between products and nutritionFacts tables with WHERE clauses for all nutritional filters
- **Performance Improvements**: Achieved ~99.9% reduction in data transfer and memory usage by eliminating need to load all products into memory
- **Scalable Implementation**: Changed from O(n) to O(1) performance relative to database size using SQL LIMIT/OFFSET pagination after filtering
- **Accurate Pagination**: Fixed total count calculations to reflect filtered dataset, not entire category count (e.g., NutriScore A,B filter shows 2516 products instead of incorrect 8460)
- **Consistent Multi-Page Results**: Users now see properly filtered and sorted results across all pages, not just current page
- **Enhanced Search Integration**: Applied same SQL-level improvements to search functionality for consistency
- **Production Verification**: Successfully tested and published with confirmed working filters for NutriScore grades, sugar/fat/protein/salt ranges, and search queries
- **DATABASE LEVEL**: All filtering, sorting, and counting now happens at SQL level with proper JOINs, WHERE clauses, and ORDER BY statements for optimal performance and scalability

### Header Updates (October 2025) ✅ COMPLETED
- **Petition Link Addition**: Replaced tagline with petition link to manabalss.lv for healthy nutrition labeling initiative
- **Bilingual Support**: Link text in both Latvian ("Par veselīga uztura marķējumu uz preču cenu zīmēm veikalos") and English ("About healthy nutrition labeling on product price tags in stores")
- **Mobile Optimization**: Icon hidden on mobile to prevent text wrapping issues; visible on desktop
- **User Experience**: Opens in new tab with proper security attributes (noopener noreferrer)
- **Styling**: Styled in primary color (green) with hover effects for better visibility

### SEO Improvements (October 2025) ✅ COMPLETED  
- **robots.txt Implementation**: Added properly formatted robots.txt file to allow search engine crawling
- **File Location Fix**: Moved to client/public/ folder for correct Vite build and deployment (was incorrectly in client/ root)
- **Configuration**: Allows all search engines (User-agent: *) to crawl all content (Allow: /)
- **PageSpeed Compliance**: Resolved PageSpeed.web.dev error about invalid robots.txt returning HTML
- **Content Type**: Properly serves as text/plain instead of text/html
- **Static Assets**: Both robots.txt and favicon.ico now correctly placed in client/public/ for production deployment

### Mobile Camera Scanner Feature (October 2025) ✅ COMPLETED
- **Camera Scanning Implementation**: Added complete camera scanning feature for photographing product price tags in-store
- **Mobile-Only Access**: Enforces mobile device detection; desktop users see informative message
- **Rear Camera Preference**: Uses environment-facing camera (rear camera) with high-resolution settings (1920x1080)
- **Manual Camera Control**: Implements "Start Camera" button for better user permission handling
- **Visual Frame Guide**: Green border overlay helps users align price tags for optimal capture
- **Capture & Retake**: Full capture/retake workflow with image preview after capture
- **Bilingual Support**: Complete translations in both Latvian and English for all scanner UI elements
- **Error Handling**: Comprehensive error messages for permission denied, camera not found, and browser support issues
- **Clean Camera Management**: Proper stream cleanup on component unmount and camera restart
- **Camera Initialization Fix**: Resolved video stream display issue with proper initialization sequence (set cameraReady first, wait 100ms for DOM render, then attach stream)
- **Retake Functionality**: Fixed retake button to properly restart camera using same initialization logic as initial start
- **Scanner Route**: Accessible via header scan button (camera icon) at /lv/scan and /en/scan routes
- **16:9 Horizontal Frame**: Optimized capture frame for price tag scanning with perfect 16:9 landscape aspect ratio
- **Cropping Logic**: Captures only the framed area for clean, focused product images
- **Optimized Camera Layout**: 16:9 aspect ratio camera view with 60vh minimum height ensures frame and capture button are visible without scrolling
- **Debug Mode**: VITE_DEBUG_MODE environment variable controls visibility of "Detected text" box for debugging without republishing

### OCR and Product Recognition (October 2025) ✅ COMPLETED
- **Google Cloud Vision API Integration**: Full OCR text extraction from captured price tag images using Vision API TEXT_DETECTION
- **Individual Text Segment Extraction**: Uses textAnnotations[1:] to extract individual text segments (not full text blob)
- **Latvian Text Normalization**: Applies normalizeLvText() to all segments, replacing diacritics with Latin equivalents
- **Segment Filtering**: Filters out segments shorter than 4 characters to reduce noise
- **Two-Pass Token Matching Algorithm** (proven approach from reference implementation):
  - **Pass 1 (SQL Search)**: Finds potential product matches by searching database for products containing any normalized segment
  - **Pass 2 (Token Verification)**: For each potential match:
    - Splits product name into tokens using whitespace
    - Filters to significant tokens (> 3 characters)
    - Counts how many tokens appear in OCR segments
    - Calculates match confidence (matching tokens / total tokens)
    - Requires >= 60% confidence threshold
  - **Ranking**: Sorts matches by confidence (descending), then token count (descending)
  - **Returns**: Only the best match with highest confidence
- **Performance Optimized**: Uses SQL-level search with name_norm indexed field for fast segment matching
- **Product Information Display**: Shows matched product name, Nutri-Score, and link to product details
- **Error Handling**: Comprehensive error checking for Vision API failures and empty results
- **Secret Management**: Uses GOOGLE_CLOUD_API_KEY environment variable for secure API authentication

### Google Tag Manager Analytics Enhancement (October 2025) ✅ COMPLETED
- **Analytics Utility Creation**: Created centralized `client/src/lib/analytics.ts` helper for GTM event tracking
- **Product Scan Tracking**: Captures successful product scans with product ID, name, Nutri-Score, and OCR confidence
- **View Details Tracking**: Tracks when users click "View Details" button after scanning a product
- **Petition Link Tracking**: Monitors clicks on manabalss.lv petition link with language context
- **Camera Permission Tracking**: Records camera permission grants/denials for UX insights
- **Scan Failure Tracking**: Logs failed scans with failure reasons and detected text status for debugging
- **GTM Integration**: All events sent to window.dataLayer for processing in Google Tag Manager (GTM-P46NQX5H)
- **Event Structure**: Standardized event format with descriptive names and relevant metadata
- **Language Context**: All relevant events include language information (lv/en) for localized analytics
- **Non-Blocking Implementation**: Analytics calls don't interfere with app performance or user experience