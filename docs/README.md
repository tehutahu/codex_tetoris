# Documentation

This directory contains comprehensive documentation for the codex_tetoris project, including architecture diagrams, system overviews, and detailed technical specifications.

## Overview

The codex_tetoris project is a modern web-based Tetris game implementation that supports real-time multiplayer gameplay. Built with React and Phaser for the frontend, and Node.js with Socket.IO for the backend, it provides a complete gaming experience with responsive controls and smooth multiplayer synchronization.

## Architecture Documentation

### [System Overview](architecture/system-overview.md)
High-level system architecture showing the relationship between frontend, backend, and communication layers. This document provides a comprehensive view of how all components work together.

**Key Topics:**
- Frontend layer with React and Phaser
- Backend layer with Node.js and Express
- Real-time communication with Socket.IO
- Dependency management and version information

### [Client Components](architecture/client-components.md)
Detailed breakdown of the client-side component structure, including React components, Phaser integration, and game state management.

**Key Topics:**
- React component hierarchy
- Phaser game engine integration
- Game state management
- Input handling system
- Network communication

### [Multiplayer Flow](architecture/multiplayer-flow.md)
Real-time multiplayer communication flow and data synchronization between players.

**Key Topics:**
- WebSocket connection management
- State broadcasting and synchronization
- Network events and data flow
- Performance considerations
- Future enhancement possibilities

### [Game Logic](architecture/game-logic.md)
Core game mechanics, methods, and their relationships within the Tetris gameplay system.

**Key Topics:**
- Game loop and update cycle
- Piece movement and rotation
- Collision detection system
- Line clearing algorithm
- Scoring system
- Network state synchronization

### [Project Structure](architecture/project-structure.md)
File organization, dependencies, and build processes for the entire project.

**Key Topics:**
- Directory structure and file organization
- Package configuration and dependencies
- Build process for development and production
- Docker deployment options
- Technology stack overview

## Quick Reference

### Technology Stack
- **Frontend**: React 18.2.0, Phaser 3.70.0, Vite 7.0.4
- **Backend**: Node.js, Express 4.18.2, Socket.IO 4.7.2
- **Development**: npm workspaces, Docker, Git

### Key Features
- Real-time multiplayer gameplay
- Responsive game controls
- Modern React architecture
- Efficient Phaser rendering
- WebSocket-based communication
- Cross-platform compatibility

### Build Commands
```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Docker deployment
docker build -t codex_tetoris .
docker run -p 3000:3000 codex_tetoris
```

## Document Structure

Each architecture document follows a consistent structure:

1. **Overview**: High-level description of the topic
2. **Mermaid Diagram**: Visual representation of the system/flow
3. **Key Components**: Detailed breakdown of major elements
4. **Implementation Details**: Code examples and technical specifics
5. **Additional Information**: Context and future considerations

## Viewing Mermaid Diagrams

The documentation includes Mermaid diagrams that can be viewed in:
- **GitHub**: Native Mermaid support in markdown files
- **Visual Studio Code**: Mermaid preview extensions
- **Mermaid Live Editor**: https://mermaid.live/
- **Documentation websites**: Most support Mermaid rendering

## Contributing

When updating the documentation:

1. Keep diagrams in sync with code changes
2. Update version numbers in dependency references
3. Maintain consistent formatting and structure
4. Test Mermaid diagrams before committing
5. Update this README when adding new documents

## Related Files

- **Root README**: `/README.md` - Project setup and usage instructions
- **Source Code**: `/client/src/` - Implementation details
- **Configuration**: `/package.json`, `/vite.config.js` - Build setup
- **Deployment**: `/Dockerfile` - Container configuration 