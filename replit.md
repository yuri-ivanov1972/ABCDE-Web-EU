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
- **Google Analytics**: User behavior tracking and site analytics
- **Google Tag Manager**: Tag and conversion tracking management

### Asset Management
- **SVG to ICO Conversion**: Favicon generation from vector graphics
- **Vite Asset Processing**: Optimized asset bundling and serving
- **Static File Serving**: Efficient delivery of images and other assets

### Text Processing
- **Latvian Language Support**: Character normalization for diacritics and special characters
- **Search Optimization**: Text processing for improved product discovery