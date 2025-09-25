# OPC UA Dashboard

## Overview

This is a web-based dashboard for monitoring and managing OPC UA (Open Platform Communications Unified Architecture) servers and PLCs in industrial IoT environments. The application provides real-time data visualization, JSON-based PLC configuration management, and multilingual support (English/Japanese). It features a modern, responsive interface optimized for industrial monitoring with live data tracking, server connection management, and comprehensive status monitoring.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern development practices
- **Routing**: Wouter for lightweight client-side routing
- **UI Framework**: shadcn/ui component library built on Radix UI primitives for accessible, customizable components
- **Styling**: Tailwind CSS with custom design tokens following Material Design principles adapted for industrial applications
- **State Management**: TanStack Query for server state management with optimistic updates and caching
- **Real-time Communication**: Socket.IO client for live data subscriptions and WebSocket connections

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Build System**: Vite for development and production builds with ESBuild for server bundling
- **WebSocket**: Socket.IO server for real-time bidirectional communication
- **File Handling**: Multer middleware for JSON configuration file uploads
- **API Pattern**: RESTful endpoints with standardized error handling and logging middleware

### Database & Data Layer
- **ORM**: Drizzle ORM configured for PostgreSQL with type-safe database operations
- **Database**: PostgreSQL (via Neon serverless) for production with connection pooling
- **Storage Interface**: Abstracted storage layer with in-memory implementation for development
- **Schema Management**: Centralized schema definitions using Zod for runtime validation

### Component Design System
- **Color Palette**: Dark mode optimized for industrial environments with blue-gray backgrounds and bright status indicators
- **Typography**: Inter font family with JetBrains Mono for data values and timestamps
- **Layout System**: Consistent spacing using Tailwind's 4-unit grid system
- **Status Indicators**: Color-coded system (green/active, amber/maintenance, red/error) for device health
- **Responsive Design**: Mobile-first approach with collapsible sidebar and adaptive layouts

### Real-time Data Architecture
- **Subscription Model**: Event-driven architecture for PLC data updates
- **Connection Management**: Selective server connections with automatic reconnection handling
- **Data Updates**: 500ms-1s refresh intervals with subscription-based updates to minimize polling
- **State Synchronization**: Client-server state sync through WebSocket events

### Internationalization
- **Language Support**: English and Japanese localization
- **Component Integration**: Language switcher component with context-based translations
- **Design Consideration**: UI accommodates varying text lengths between languages

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18+ with React DOM for modern component lifecycle
- **TypeScript**: Full TypeScript support across client and server
- **Vite**: Development server and build tooling with HMR support

### UI Component Libraries
- **Radix UI**: Headless component primitives for accessibility and customization
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **shadcn/ui**: Pre-built component library with consistent design patterns
- **Lucide React**: Icon library for consistent iconography

### Backend Services
- **Neon Database**: Serverless PostgreSQL for production deployments
- **Socket.IO**: Real-time WebSocket communication for live data streams
- **Express.js**: Web server framework with middleware ecosystem

### Development Tools
- **Drizzle Kit**: Database migration and schema management
- **ESBuild**: Fast JavaScript bundler for server-side code
- **PostCSS**: CSS processing with Tailwind integration

### Validation & Forms
- **Zod**: Runtime schema validation for API requests and responses
- **React Hook Form**: Form state management with validation integration
- **Hookform Resolvers**: Zod integration for form validation

### Data Fetching & State
- **TanStack Query**: Server state management with caching and synchronization
- **Date-fns**: Date/time manipulation for timestamp handling

### Session Management
- **connect-pg-simple**: PostgreSQL session store for user sessions
- **Express Session**: Session middleware for authentication state