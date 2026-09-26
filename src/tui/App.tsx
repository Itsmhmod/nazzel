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
import { HistoryScreen } from './screens/HistoryScreen.js';
import { CheckingEnvironmentScreen } from './screens/CheckingEnvironmentScreen.js';
import { RepairScreen } from './screens/RepairScreen.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import type { IDownloadOrchestrator } from '../application/interfaces/IDownloadOrchestrator.js';
import type { IHistoryManager } from '../application/interfaces/IHistoryManager.js';
import type { IDiagnosticsRunner } from '../application/interfaces/IDiagnosticsRunner.js';
import type { IAppEventBus } from '../application/interfaces/IAppEventBus.js';
import type { IMediaInfo } from '@nazzel/domain/types.js';
import { AppError } from '@nazzel/domain/errors.js';

import type { IDependencyManager } from '../application/interfaces/IDependencyManager.js';

export interface ITuiDependencies {
  orchestrator: IDownloadOrchestrator;
  eventBus: IAppEventBus;
  diagnosticsRunner: IDiagnosticsRunner;
  historyManager: IHistoryManager;
  depManager: IDependencyManager;
}

export interface AppProps {
  deps: ITuiDependencies;
  initialUrl?: string | undefined;
}

export function App({ deps, initialUrl }: AppProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { exit } = useApp();

  const handleSubmitUrl = useCallback((url: string) => {
    const downloadId = 'dl-' + Math.random().toString(36).substring(2, 9);
    dispatch({ type: 'UI_SUBMIT_URL', url, downloadId });
    // Trigger analysis asynchronously
    deps.orchestrator.analyze(url, downloadId)
      .then((info: IMediaInfo) => {
        dispatch({ type: 'UI_SHOW_FORMATS', info });
      })
      .catch((error: any) => {
        if (error.code === 'CANCELLED') {
          return;
        }
        dispatch({
          type: 'DOWNLOAD_FAILED',
          downloadId,
          error
        });
      });
  }, [dispatch, deps.orchestrator]);

  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    // Only run dependency check on startup
    if (isInitialized) {return;}
    
    dispatch({ type: 'UI_CHECKING_ENV' });
    void deps.depManager.detectAll().then(report => {
      if (!report.allOk) {
        dispatch({ type: 'UI_REPAIRING', report });
      } else {
        dispatch({ type: 'UI_RESTART' });
        setIsInitialized(true);
        if (initialUrl) {
          handleSubmitUrl(initialUrl);
        }
      }
    });
  }, [isInitialized, deps.depManager, initialUrl, handleSubmitUrl]);

  // Listen to domain events and dispatch them to the reducer.
  // Throttle PROGRESS_UPDATE to avoid React/Ink layout thrashing.
  useAppEventBus(deps.eventBus, dispatch, 200);

  // Global exit mechanism
  const handleQuit = () => {
    // If there's an active download, cancel it first
    if (state.downloadId) {
      deps.orchestrator.cancel(state.downloadId);
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

  const handleShowHistory = () => {
    dispatch({ type: 'UI_TOGGLE_HISTORY' });
  };

  const handleFormatSelected = (formatId: string) => {
    if (!state.url || !state.mediaInfo) {
      return;
    }
    dispatch({ type: 'UI_FORMAT_SELECTED', formatId });
    
    // Construct download ID
    const downloadId = 'dl-' + Math.random().toString(36).substring(2, 9);
    
    deps.orchestrator.download({
      url: state.url,
      formatId,
    }, downloadId, state.mediaInfo.title);
  };

  const handleCancelDownload = () => {
    if (state.downloadId) {
      deps.orchestrator.cancel(state.downloadId);
    }
  };




  // Rendering router
  let screenElement: React.ReactNode = null;

  switch (state.screen) {
    case 'CHECKING_ENV':
      screenElement = <CheckingEnvironmentScreen />;
      break;
    case 'REPAIRING':
      screenElement = (
        <RepairScreen 
          report={state.dependencyReport!}
          progress={state.repairProgress}
          onConfirm={() => {
            void deps.depManager.installMissing((name, downloaded, total) => {
              dispatch({ type: 'UI_REPAIR_PROGRESS', name, downloaded, total });
            }).then(success => {
              if (success) {
                dispatch({ type: 'UI_RESTART' });
                // We are initialized
                if (initialUrl) {handleSubmitUrl(initialUrl);}
              } else {
                dispatch({ type: 'DOWNLOAD_FAILED', downloadId: '', error: AppError.from('DEPENDENCY_INSTALL_FAILED', 'Failed to install dependencies') });
              }
            });
          }}
          onQuit={handleQuit}
        />
      );
      break;
    case 'HOME':
      screenElement = (
        <HomeScreen 
          onSubmit={handleSubmitUrl}
          onShowDiagnostics={handleShowDiagnostics}
          onShowHistory={handleShowHistory}
          onQuit={handleQuit} 
        />
      );
      break;
    case 'ANALYZING':
      screenElement = (
        <AnalyzingScreen 
          url={state.url || ''} 
          onCancel={() => {
            handleCancelDownload();
            handleRestart();
          }} 
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
          runner={deps.diagnosticsRunner}
          onClose={handleShowDiagnostics}
        />
      );
      break;
    case 'HISTORY':
      screenElement = (
        <HistoryScreen 
          historyManager={deps.historyManager}
          onClose={handleShowHistory}
        />
      );
      break;
  }

  return (
    <ErrorBoundary>
      <Box>
        {screenElement}
      </Box>
    </ErrorBoundary>
  );
}
