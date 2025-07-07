# Archive Directory

This directory contains complex sandbox management code that has been moved here for future reference while maintaining the system's basic functionality.

## What's Archived

The following sandbox management files have been moved to `archive/sandbox/`:

- **sandbox-pool.ts** - Advanced sandbox pooling system with pre-warming and maintenance cycles
- **init-sandbox-pool.ts** - Initialization code for the sandbox pool
- **app-sandbox-manager.ts** - Application-specific sandbox management with caching
- **refresh-manager.ts** - Sandbox refresh and recreation management
- **single-active-manager.ts** - Single active sandbox session management
- **reconnect.ts** - Sandbox reconnection and session management
- **use-sandbox-manager.ts** - React hook for sandbox management
- **version-warmup.ts** - Version-based sandbox warming and caching

## Why Archived

These files implemented complex sandbox management features including:

- Sandbox pooling with pre-warming
- Advanced caching and reconnection logic
- Session-based sandbox management
- Version-based warming strategies
- Complex maintenance cycles

While functional, this complexity was causing issues with the simplified architecture. The basic sandbox functionality has been maintained in the main codebase, while these advanced features are preserved here for future reference or potential re-implementation.

## Usage

These files are not actively used by the main application but are preserved for:

1. **Reference** - Understanding previous implementation approaches
2. **Recovery** - Potential restoration of advanced features if needed
3. **Learning** - Studying complex sandbox management patterns
4. **Migration** - Basis for future improved implementations

## Integration

If you need to restore any of these features:

1. Review the archived implementation
2. Update import paths from `archive/sandbox/` to your target location
3. Ensure dependencies are properly resolved
4. Test thoroughly before deploying

The archived code maintains its original structure and functionality, only the location has changed. 