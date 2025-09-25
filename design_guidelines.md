# OPC UA Dashboard Design Guidelines

## Design Approach
**System Approach**: Following Material Design principles with enterprise customizations for industrial IoT applications. This utility-focused dashboard prioritizes data clarity, real-time monitoring efficiency, and operational reliability.

## Core Design Elements

### Color Palette
**Dark Mode Primary** (recommended for industrial environments):
- Background: `210 20% 8%` (deep blue-gray)
- Surface: `210 15% 12%` 
- Primary: `210 100% 60%` (bright blue for status indicators)
- Success: `120 60% 50%` (operational green)
- Warning: `45 100% 60%` (amber alerts)
- Error: `0 70% 55%` (critical red)
- Text Primary: `210 10% 95%`
- Text Secondary: `210 10% 70%`

**Light Mode Alternative**:
- Background: `210 20% 98%`
- Surface: `210 15% 95%`
- Text Primary: `210 20% 15%`

### Typography
- **Primary Font**: Inter via Google Fonts
- **Monospace**: JetBrains Mono for data values and timestamps
- **Hierarchy**: text-xs (12px) for metadata, text-sm (14px) for body, text-lg (18px) for headings, text-2xl (24px) for dashboard titles

### Layout System
**Spacing Primitives**: Consistent use of Tailwind units `2, 4, 8, 12` for padding, margins, and gaps
- Grid layouts with 4-unit gutters
- Card padding of 6 units
- Section spacing of 12 units

### Component Library

**Navigation**:
- Fixed sidebar with collapsible sections
- Breadcrumb navigation for deep data hierarchies
- Quick action toolbar with connection status

**Data Display**:
- **Metric Cards**: Large numerical displays with trend indicators
- **Real-time Charts**: Time series with configurable intervals
- **Status Indicators**: Color-coded connection states and device health
- **Data Tables**: Sortable, filterable with live updates
- **Alert Panels**: Hierarchical severity with timestamp tracking

**Forms & Controls**:
- Configuration panels with grouped settings
- Toggle switches for boolean values
- Slider inputs for threshold adjustments
- Multi-language selector dropdown

**Overlays**:
- Modal dialogs for device configuration
- Toast notifications for connection events
- Contextual tooltips for technical terminology

### Visual Hierarchy
- **High Priority**: Connection status, critical alerts (large, prominent)
- **Medium Priority**: Live data values, recent changes (standard sizing)
- **Low Priority**: Historical data, configuration options (compact, secondary styling)

### Responsive Behavior
- Desktop-first approach for monitoring stations
- Tablet adaptation with collapsible sidebar
- Mobile summary view with essential metrics only

### Performance Considerations
- Minimal animations limited to data transitions and loading states
- Efficient data visualization with canvas-based charts
- Optimistic UI updates for real-time data streams

This design prioritizes operational clarity, reduces cognitive load during monitoring tasks, and maintains professional aesthetics suitable for industrial environments.