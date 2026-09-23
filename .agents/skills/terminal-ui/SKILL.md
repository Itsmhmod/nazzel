---
name: terminal-ui
description: >
  Patterns, pitfalls, and best practices for building TUI screens with React + Ink.
  Use when implementing or modifying any TUI screen or component.
---

# Skill: Terminal UI with React + Ink

## Key Imports

```typescript
import { render, Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { render as testRender } from 'ink-testing-library';
```

## State Machine Pattern

The TUI state is managed by a pure reducer. Ink components subscribe to state via a context hook:

```typescript
// The reducer — pure, no side effects
export function tuiMachineReducer(state: TuiState, event: TuiEvent): TuiState {
  switch (state.screen) {
    case 'HOME':
      if (event.type === 'URL_SUBMITTED') return { ...state, screen: 'ANALYZING', url: event.url };
      return state;
    // ...
  }
}

// In App.tsx — the only place useState lives
const [state, dispatch] = useReducer(tuiMachineReducer, initialState);
```

## Screen Routing Pattern

```typescript
// App.tsx
function App({ state, dispatch }: AppProps) {
  switch (state.screen) {
    case 'HOME': return <HomeScreen state={state} dispatch={dispatch} />;
    case 'ANALYZING': return <AnalyzingScreen state={state} />;
    case 'FORMATS': return <FormatsScreen state={state} dispatch={dispatch} />;
    // ...
  }
}
```

## Keyboard Handling

```typescript
// In a screen component
useInput((input, key) => {
  if (key.escape) dispatch({ type: 'CANCELLED' });
  if (key.return) dispatch({ type: 'FORMAT_SELECTED', formatId: selected });
});
```

## Progress Update Throttling

**Critical performance rule**: Never trigger a re-render on every progress tick. yt-dlp emits many progress lines per second.

```typescript
// In useProgress hook — throttle to 200ms
const [progress, setProgress] = useState<IDownloadProgress | null>(null);

useEffect(() => {
  let pending: IDownloadProgress | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsub = eventBus.on('PROGRESS_UPDATE', (event) => {
    pending = event.progress;
    if (!timer) {
      timer = setTimeout(() => {
        if (pending) setProgress(pending);
        pending = null;
        timer = null;
      }, 200);
    }
  });

  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}, [eventBus]);
```

## No Business Logic in Components

```typescript
// ❌ FORBIDDEN in .tsx files
const bestFormat = formats.sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0))[0];

// ✅ This logic lives in src/infrastructure/ytdlp/formats.ts
// The component receives an already-sorted array as a prop
```

## Testing with ink-testing-library

```typescript
import { render } from 'ink-testing-library';
import { HomeScreen } from '../../../src/tui/screens/HomeScreen.js';

it('renders the URL prompt', () => {
  const { lastFrame } = render(<HomeScreen state={homeState} dispatch={vi.fn()} />);
  expect(lastFrame()).toContain('Enter a URL');
});
```

## Common Pitfalls

| Pitfall | Solution |
|---|---|
| Re-rendering on every progress event | Throttle progress updates to 200ms |
| Using `process.exit()` inside a component | Use `useApp().exit()` from Ink |
| Writing to stdout from a component | All output goes through Ink's renderer |
| Blocking the render loop with sync I/O | All I/O is async, triggered by events |
| Forgetting to unsubscribe from eventBus | Return cleanup function from useEffect |
