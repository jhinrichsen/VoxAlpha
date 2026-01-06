# AI Agent Rules

## Git
- Always use [Conventional Commits](https://www.conventionalcommits.org/)

## Makefile
1. No echo commands - let the commands speak for themselves
2. No @ prefix - show all commands being executed
3. Keep commands minimal and focused
4. Use comments to explain why, not what
5. Always place a `.PHONY` declaration right above each target, one `.PHONY` per target

Example:
```makefile

.PHONY: target-name
target-name:

    # commands here
```
