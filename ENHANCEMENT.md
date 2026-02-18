# Visual Subnet Calculator Enhancements

This document lists all improvements made in `visual-subnet-calculator` compared to the original `subnets` project.

---

## 1. Project Architecture

| Aspect | Original (`subnets`) | Enhanced (`visual-subnet-calculator`) |
|--------|---------------------|--------------------------------------|
| **File Structure** | Single HTML file (~610 lines) | Modular structure with separate CSS and JS files |
| **JavaScript Style** | Legacy ES5 with `var`, `function` declarations | Modern ES6+ with `const`/`let`, arrow functions |
| **HTML Doctype** | No DOCTYPE declaration | Proper HTML5 `<!DOCTYPE html>` with `lang="en"` |
| **Character Encoding** | Not specified | UTF-8 charset declared |

---

## 2. New Features

### 2.1 Network Name Field
- **Added**: Input field for `network_name` to label/identify the network being calculated
- **Benefit**: Users can now save descriptive names along with their subnet configurations

### 2.2 Customizable IP Reservation
- **Original**: Hardcoded reservation of 1 IP at start (network) and 1 IP at end (broadcast)
- **Enhanced**: Configurable `reserve_front` and `reserve_end` inputs
  - Users can specify how many IPs to reserve at the beginning and end of each subnet
  - Input validation ensures minimum value of 1
  - Affects usable IP range and host count calculations dynamically

### 2.3 Remark/Comment Column
- **Added**: New "Remark" column with editable text inputs for each subnet row
- **Features**:
  - In-place editing with text input fields
  - Remarks are serialized and saved in bookmark URLs
  - Can be shown/hidden via column toggle
- **Benefit**: Users can annotate subnets with descriptions or notes

### 2.4 Column Visibility Persistence
- **Original**: Column visibility resets on page reload
- **Enhanced**: Column visibility state is serialized and stored in the bookmark URL
  - Uses hexadecimal encoding for compact representation
  - Automatically restored when loading from a bookmark

---

## 3. User Interface Improvements

### 3.1 Visual Hierarchy
- **Join Button Highlighting**: Added cascade highlighting on hover
  - Highlights all associated subnet rows when hovering over a join button
  - Highlights all child CIDR blocks in the hierarchy
  - Visual feedback helps users understand which subnets will be affected

### 3.2 Editable Styling
- **New CSS Classes**:
  - `.join-highlight` / `.join-highlight-row`: Highlight states for join button hover effects
  - `.calc input[type="text"]`: Styled input fields within the calculation table
  - Hover effects on joinable cells (`maskSpanJoinable:hover`)

### 3.3 Form Inputs
- Modernized input styling with:
  - Border radius for softer appearance
  - Focus states with blue border highlight
  - Consistent padding and font sizing

### 3.4 Removed External Dependencies
- **Original**: Included GitHub "Fork me" ribbon image from external CDN
- **Enhanced**: Clean interface without external image dependencies

---

## 4. Algorithm & Logic Improvements

### 4.1 IP Address Calculations
- **Fixed**: Signed/unsigned bitwise operations using `>>>` (unsigned right shift)
- **Improved**: Network address calculation using modern bitwise operations

### 4.2 Host Count Logic
- **Original**: Hardcoded special cases for /31 and /32 masks
- **Enhanced**: Dynamic calculation based on user-defined reserve values
  - Properly handles edge cases where usable range is invalid
  - Shows "N/A" when no usable IPs are available

### 4.3 Node Identification
- **Added**: Unique node IDs (`nodeIdCounter`) for precise DOM element tracking
- **Benefit**: Enables reliable highlight cascade and relationship mapping

---

## 5. Data Serialization Enhancements

### 5.1 URL Parameter Expansion
Bookmark URLs now include:
- `network` - Network address
- `mask` - CIDR mask bits
- `division` - Subnet tree structure (existing)
- `remarks` - User annotations (**NEW**)
- `cols` - Column visibility state (**NEW**)
- `rf` - Reserve front count (**NEW**)
- `re` - Reserve end count (**NEW**)
- `name` - Network name (**NEW**)

### 5.2 Remark Serialization
- **Function**: `collectRemarks()` - Gathers all leaf node remarks
- **Function**: `applyRemarks()` - Restores remarks to tree structure
- **Encoding**: URL-encoded for safe transmission

---

## 6. Code Quality Improvements

### 6.1 Code Organization
| Original | Enhanced |
|----------|----------|
| Mixed HTML/CSS/JS | Separation of concerns (HTML/CSS/JS files) |
| Global variables | Modular variable scope |
| Comments as code dividers | JSDoc-style documentation |

### 6.2 Function Refactoring
- `inet_ntoa` → `inetNtoa` (camelCase convention)
- `inet_aton` → `inetAton` (camelCase convention)
- Extracted `createNode()`, `divideNode()`, `joinNode()` for clarity
- Added `updateSaveLink()` for incremental bookmark updates

### 6.3 Data Structures
- **Enhanced Node Structure**: `[depth, numChildren, children, remark, nodeId]`
  - Added `remark` field for annotations
  - Added `nodeId` for unique identification

### 6.4 Error Handling
- Input validation for reserve fields (minimum value enforcement)
- Safer query string parsing with default values

---

## 7. Removed Elements

| Element | Reason |
|---------|--------|
| 33 GIF image files (`img/0.gif` to `img/32.gif`) | Replaced with text-based CIDR notation (`/24`, `/16`, etc.) |
| GitHub "Fork me" ribbon | External dependency removed for cleaner UI |
| `maskSpanRotate` CSS class | Unused IE-specific filter removed |
| Preload image logic | No longer needed without GIF images |

---

## 8. Summary

The enhanced `visual-subnet-calculator` represents a significant modernization of the original tool:

1. **Better Usability**: Configurable IP reservations, remarks, and column persistence
2. **Cleaner Code**: ES6+ syntax, modular architecture, better documentation
3. **Improved UX**: Visual highlighting, modern styling, no external dependencies
4. **Enhanced Functionality**: Network naming, dynamic calculations, complete state serialization

All improvements maintain backward compatibility with the core subnet calculation logic while adding powerful new capabilities for network administrators.
