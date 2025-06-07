# Changelog

All notable changes to this project will be documented in this file.

## [3.17.0] - 2025-01-13

### Fixed
- **Restored Intelligent Search**: Fixed the over-simplified search that was just taking top Algolia results
  - Re-implemented AI-powered query analysis that understands user intent
  - Now generates multiple search strategies based on synonyms and related concepts
  - Enhanced content extraction from all Algolia fields (hierarchy, highlights, snippets)
  - Intelligent relevance scoring that considers:
    - Title matches (highest weight)
    - Content relevance and keyword density
    - Algolia's ranking signals
    - Content type and URL relevance
  
### Improved
- **Better Search Results**: Search now finds more relevant documentation by:
  - Understanding what users are really asking for
  - Searching with multiple strategies (e.g., "react integration", "react setup", "react hooks")
  - Intelligently ranking results based on multiple factors
  - De-duplicating results across different search queries
  
### Technical
- Restored `ENHANCED_QUERY_ANALYSIS_PROMPT` for better AI understanding
- Enhanced `SearchOrchestrator` with smarter content extraction
- Added comprehensive relevance scoring algorithm
- Maintained clean code structure (~400 lines vs original 678)

## [3.16.0] - 2025-01-13

### Major Optimizations
- **Simplified Configuration**: Removed over-engineered configuration options
  - Removed rarely-used UI customization options (loadingText, retryButtonText, etc.)
  - Consolidated research config into top-level options (enableCaching, cacheTTL, maxSearchQueries)
  - Removed separate queryAnalysis model config - now uses main OpenAI model
  - Removed intelligentSearch toggle - always enabled when using AI
  
- **Streamlined Search Orchestrator**: Reduced from 678 to ~250 lines
  - Removed sitemap parsing and discovery functionality
  - Removed HTML content extraction (uses Algolia results directly)
  - Simplified query analysis to just generate search queries
  - Removed complex progress tracking with detailed steps
  - Simplified relevance scoring algorithm
  
- **Simplified Logger**: Reduced from 160 to ~50 lines
  - Removed specialized logging methods
  - Kept only essential log() and logError() methods
  
- **Cleaned Up CSS**: Reduced from ~600 to ~300 lines
  - Removed custom CSS variable system
  - Removed redundant admonition styles
  - Better integration with Docusaurus theme variables
  
- **Removed Unused Code**:
  - Deleted analytics.ts (unused)
  - Deleted documentRetrieval.ts (unused)
  - Removed unused type definitions and constants

### Performance Improvements
- **50% reduction in code size** - faster bundle loading
- **Simplified dependencies** - fewer potential bugs
- **Better defaults** - most users won't need any configuration beyond proxy URL

### Developer Experience
- **Clearer code structure** - each file has a single responsibility
- **Easier maintenance** - less code means fewer bugs
- **Still extensible** - advanced features remain available

## [3.2.0] - 2024-12-19

### Added
- **Comprehensive Logging System**: Added `enableLogging` parameter for debugging the RAG pipeline
  - Logs search query processing with detailed search results
  - Tracks content retrieval from documentation pages with success/failure status
  - Shows RAG content preparation with document lengths and previews
  - Displays full prompt generation (system and user prompts)
  - Logs API requests and responses with payloads
  - Tracks performance metrics for each operation
  - Includes content summarization metrics when enabled
- **Logger Utility Module**: New `AISearchLogger` class with specialized logging methods
- **Detailed Documentation**: Added "Debugging with enableLogging" section in README
- **Example Implementation**: Created `examples/logging-example.js` demonstrating logging usage

### Improved
- Enhanced error tracking throughout the content retrieval pipeline
- Better visibility into the RAG process for optimization
- Performance monitoring capabilities for identifying bottlenecks

## [3.1.0] - Previous releases
- AI-enhanced search with OpenAI integration
- Secure backend proxy support
- Customizable prompts and UI
- Content summarization features
- llms.txt support for additional context

## v3.14.0 (January 13, 2025)

### Improvements
- **Restored AI-powered query analysis** for better search accuracy
- **Enhanced query understanding** with improved AI prompts that consider synonyms and related concepts
- **Balanced performance and accuracy** - now makes 2 AI calls (analysis + synthesis) instead of 30+
- **Better search strategy** - AI generates up to 3 targeted search queries based on intent
- **Smarter keyword extraction** - AI understands context and generates relevant search terms

### Technical Changes
- Re-enabled intelligent search by default
- Increased maxSearchQueries from 1 to 3 for better coverage
- Enhanced AI prompt with examples and better instructions
- Improved timeout handling (increased to 20 seconds)
- Better fallback to keyword extraction if AI analysis fails

### Performance
- **AI Calls**: 2 per search (1 for analysis, 1 for synthesis)
- **Search Accuracy**: Significantly improved through AI-driven query analysis
- **Cache Performance**: Instant response for repeated queries

## v3.13.0 (January 13, 2025)

### Performance Improvements
- **Reduced AI calls from 30+ to 1**: Fixed duplicate API calls during re-renders
- **Removed AI-powered query analysis**: Uses simple keyword extraction instead
- **Optimized search process**: Single search query instead of multiple searches
- **Fixed caching issues**: Prevented partial cache entries causing repeated AI calls
- **Improved React performance**: Fixed useEffect dependencies to prevent unnecessary re-renders
- **Added duplicate call prevention**: Uses refs to ensure only one AI synthesis call per query

### Bug Fixes
- Fixed race condition causing multiple simultaneous AI calls
- Fixed cache normalization to improve cache hit rate
- Disabled intelligent search by default to prevent partial cache issues

### Configuration Changes
- Reduced default `maxAICalls` from 3 to 2
- Reduced default `maxSearchQueries` from 5 to 1
- Reduced default `maxDocuments` from 10 to 5
- Reduced default `timeoutSeconds` from 30 to 15

## v3.12.0 (January 5, 2025)

### New Features
- Added AI-powered intelligent search for improved documentation discovery
- Introduced deep research mode with multi-step search process
- Added configurable research parameters and caching options

### Enhancements
- Improved search result relevance with AI-driven query analysis
- Enhanced caching system for faster repeated queries
- Better progress tracking during search operations

## v3.11.0 (December 20, 2024)

### New Features
- Added support for custom OpenAI models
- Introduced configurable temperature settings
- Added retry functionality for failed queries

### Bug Fixes
- Fixed memory leak in search component
- Improved error handling for network issues 