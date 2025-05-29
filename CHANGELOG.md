# Changelog

All notable changes to this project will be documented in this file.

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