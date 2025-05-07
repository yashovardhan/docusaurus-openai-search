# Contributing to Docusaurus OpenAI Search

Thank you for contributing to this project! Here's how to get started:

## Development

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/docusaurus-openai-search.git`
3. Install dependencies: `npm install`
4. Make your changes
5. Build the project: `npm run build`

## Testing Changes

You can test your changes in a local Docusaurus project by:

1. Building the project with `npm run build`
2. Linking it to your test project: 
   ```
   cd /path/to/docusaurus-openai-search
   npm link
   cd /path/to/your-docusaurus-project
   npm link docusaurus-openai-search
   ```

## Submitting Changes

1. Make sure your code passes linting: `npm run lint`
2. Push to your fork
3. Submit a pull request

## Code Style Guidelines

- Follow existing code style
- Use TypeScript for all new code
- Add JSDoc comments to exported functions and types
- Keep components modular and focused on a single responsibility

## Pull Request Process

1. Ensure your code builds successfully
2. Update the README.md if needed
3. Make sure your PR description clearly describes the changes and their purpose

Thank you for your contributions! 