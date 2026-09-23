import React, { useReducer, useEffect, useCallback } from 'react';
import { Box, useApp } from 'ink';
import { appReducer, initialState } from './store/appReducer.js';
import { useAppEventBus } from './hooks/useAppEventBus.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { AnalyzingScreen } from './screens/AnalyzingScreen.js';
import { FormatSelectionScreen } from './screens/FormatSelectionScreen.js';
import { DownloadScreen } from './screens/DownloadScreen.js';
import { VerifyingScreen } from './screens/VerifyingScreen.js';
import { CompletedScreen } from './screens/CompletedScreen.js';
import { ErrorScreen } from './screens/ErrorScreen.js';
import { RecoveringScreen } from './screens/RecoveringScreen.js';
import { DiagnosticsScreen } from './screens/DiagnosticsScreen.js';
import type { CompositionRoot } from '../cli/CompositionRoot.js';
import type { IMediaInfo } from '@nazzel/domain/types.js';

export interface AppProps {
  root: CompositionRoot;
  initialUrl?: string | undefined;
}

export function App({ root, initialUrl }: AppProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { exit } = useApp();

  const handleSubmitUrl = useCallback((url: string) => {
    dispatch({ type: 'UI_SUBMIT_URL', url });
    // Trigger analysis asynchronously
    root.orchestrator.analyze(url)
      .then((info: IMediaInfo) => {
        dispatch({ type: 'UI_SHOW_FORMATS', info });
      })
      .catch((error: any) => {
        // We reuse the existing AppError or wrap it
        dispatch({
          type: 'DOWNLOAD_FAILED',
          downloadId: 'analyze',
          error
        });
      });
  }, [dispatch, root.orchestrator]);

  useEffect(() => {
    if (initialUrl) {
      handleSubmitUrl(initialUrl);
    }
  }, [initialUrl, handleSubmitUrl]);

  // Listen to domain events and dispatch them to the reducer.
  // Throttle PROGRESS_UPDATE to avoid React/Ink layout thrashing.
  useAppEventBus(root.eventBus, dispatch, 100);

  // Global exit mechanism
  const handleQuit = () => {
    // If there's an active download, cancel it first
    if (state.downloadId) {
      root.orchestrator.cancel(state.downloadId);
    }
    // Give it a tiny bit of time to emit CANCELLED before exiting, or just exit immediately.
    exit();
  };

  const handleRestart = () => {
    dispatch({ type: 'UI_RESTART' });
  };

  const handleShowDiagnostics = () => {
    dispatch({ type: 'UI_TOGGLE_DIAGNOSTICS' });
  };

  const handleFormatSelected = (formatId: string) => {
    if (!state.url || !state.mediaInfo) {
      return;
    }
    dispatch({ type: 'UI_FORMAT_SELECTED', formatId });
    
    // Construct download ID
    const downloadId = 'dl-' + Math.random().toString(36).substring(2, 9);
    
    root.orchestrator.download({
      url: state.url,
      formatId,
    }, downloadId, state.mediaInfo.title);
  };

  const handleCancelDownload = () => {
    if (state.downloadId) {
      root.orchestrator.cancel(state.downloadId);
    }
  };




  // Rendering router
  let screenElement: React.ReactNode = null;

  switch (state.screen) {
    case 'HOME':
      screenElement = (
        <HomeScreen 
          onSubmit={handleSubmitUrl}
          onShowDiagnostics={handleShowDiagnostics}
          onQuit={handleQuit} 
        />
      );
      break;
    case 'ANALYZING':
      screenElement = (
        <AnalyzingScreen 
          url={state.url || ''} 
          onCancel={handleRestart} 
        />
      );
      break;
    case 'FORMAT_SELECTION':
      screenElement = (
        <FormatSelectionScreen 
          mediaInfo={state.mediaInfo!} 
          onSelect={handleFormatSelected} 
          onCancel={handleRestart} 
        />
      );
      break;
    case 'DOWNLOADING':
      screenElement = (
        <DownloadScreen 
          title={state.mediaInfo?.title}
          progress={state.progress}
          onCancel={handleCancelDownload}
        />
      );
      break;
    case 'VERIFYING':
      screenElement = <VerifyingScreen />;
      break;
    case 'COMPLETED':
      screenElement = (
        <CompletedScreen 
          title={state.mediaInfo?.title}
          result={state.result}
          onRestart={handleRestart}
          onQuit={handleQuit}
        />
      );
      break;
    case 'ERROR':
      screenElement = (
        <ErrorScreen 
          error={state.error}
          onShowDiagnostics={handleShowDiagnostics}
          onQuit={handleQuit}
        />
      );
      break;
    case 'RECOVERING':
      screenElement = (
        <RecoveringScreen 
          attempt={state.recovery?.attempt || 1}
          maxAttempts={state.recovery?.maxAttempts || 3}
          onCancel={handleCancelDownload}
        />
      );
      break;
    case 'DIAGNOSTICS':
      screenElement = (
        <DiagnosticsScreen 
          runner={root.diagnosticsRunner}
          onClose={handleShowDiagnostics}
        />
      );
      break;
  }

  return (
    <Box>
      {screenElement}
    </Box>
  );
}
