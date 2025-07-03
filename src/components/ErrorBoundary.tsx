import React, { Component, ReactNode } from 'react';
import { createLogger } from '../utils';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
  showDetails: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: any) => void;
  fallback?: ReactNode;
  maxRetries?: number;
  enableLogging?: boolean;
}

/**
 * P3-001: ErrorBoundary component for comprehensive error handling
 * Wraps search components with error recovery mechanisms
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimer: NodeJS.Timeout | null = null;
  private logger: any = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      showDetails: false
    };
    
    // Initialize logger if enabled
    if (props.enableLogging) {
      this.logger = createLogger(true);
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const { onError, componentName = 'Unknown' } = this.props;
    
    // Log error details
    const errorDetails = {
      component: componentName,
      error: error.message,
      stack: error.stack,
      errorInfo: errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    };

    console.error(`[ErrorBoundary] Error caught in ${componentName}:`, errorDetails);
    
    if (this.logger) {
      this.logger.error('Component Error Boundary triggered', errorDetails);
    }
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });
    
    // Call external error handler if provided
    if (onError) {
      try {
        onError(error, errorInfo);
      } catch (callbackError) {
        console.error('[ErrorBoundary] Error in onError callback:', callbackError);
      }
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState) {
    // Clear retry timer if component recovers
    if (prevState.hasError && !this.state.hasError && this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  componentWillUnmount() {
    // Clean up retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      console.log(`[ErrorBoundary] Retrying... (${this.state.retryCount + 1}/${maxRetries})`);
      
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        showDetails: false
      }));
    } else {
      console.warn(`[ErrorBoundary] Maximum retries (${maxRetries}) reached`);
    }
  };

  handleAutoRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      console.log(`[ErrorBoundary] Auto-retrying in 3 seconds... (${this.state.retryCount + 1}/${maxRetries})`);
      
      this.retryTimer = setTimeout(() => {
        this.handleRetry();
      }, 3000);
    }
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  render() {
    const { hasError, error, errorInfo, retryCount, showDetails } = this.state;
    const { children, fallback, maxRetries = 3, componentName = 'Component' } = this.props;

    if (hasError) {
      // Custom fallback UI provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-header">
              <h3 className="error-boundary-title">
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  className="error-boundary-icon"
                >
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
                Something went wrong
              </h3>
              <p className="error-boundary-description">
                The {componentName} encountered an error and couldn't continue.
              </p>
            </div>

            <div className="error-boundary-actions">
              {retryCount < maxRetries ? (
                <button 
                  className="error-boundary-button error-boundary-button--primary"
                  onClick={this.handleRetry}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <path d="M21 2v6h-6"/>
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                    <path d="M3 22v-6h6"/>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                  </svg>
                  Try Again ({retryCount + 1}/{maxRetries})
                </button>
              ) : (
                <div className="error-boundary-max-retries">
                  <p>Maximum retry attempts reached. Please refresh the page.</p>
                  <button 
                    className="error-boundary-button error-boundary-button--secondary"
                    onClick={() => window.location.reload()}
                  >
                    Refresh Page
                  </button>
                </div>
              )}
              
              {retryCount < maxRetries && (
                <button 
                  className="error-boundary-button error-boundary-button--secondary"
                  onClick={this.handleAutoRetry}
                >
                  Auto-retry in 3s
                </button>
              )}
            </div>

            {error && (
              <div className="error-boundary-details">
                <button 
                  className="error-boundary-details-toggle"
                  onClick={this.toggleDetails}
                >
                  {showDetails ? 'Hide' : 'Show'} Error Details
                </button>
                
                {showDetails && (
                  <div className="error-boundary-details-content">
                    <div className="error-boundary-error-info">
                      <h4>Error Message:</h4>
                      <pre className="error-boundary-error-message">{error.message}</pre>
                      
                      {error.stack && (
                        <>
                          <h4>Stack Trace:</h4>
                          <pre className="error-boundary-stack-trace">{error.stack}</pre>
                        </>
                      )}
                      
                      {errorInfo && errorInfo.componentStack && (
                        <>
                          <h4>Component Stack:</h4>
                          <pre className="error-boundary-component-stack">{errorInfo.componentStack}</pre>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="error-boundary-footer">
              <p className="error-boundary-help-text">
                If this problem persists, please report it to the development team.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * P3-001: Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * P3-001: Hook for error boundary management
 */
export function useErrorBoundary() {
  return {
    triggerErrorBoundary: (error: Error) => {
      // This will trigger the error boundary
      throw error;
    },
    
    createErrorHandler: (componentName: string) => (error: Error, errorInfo?: any) => {
      console.error(`[${componentName}] Error:`, error);
      if (errorInfo) {
        console.error(`[${componentName}] Error Info:`, errorInfo);
      }
      throw error;
    }
  };
} 