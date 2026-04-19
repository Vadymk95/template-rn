type LogContext = Record<string, unknown>;

const isProd = process.env.NODE_ENV === 'production';

// TODO(observability): wire Sentry / Datadog / other crash reporter here.
// Implementation should keep this shape so call sites stay untouched.
const report = {
    breadcrumb: (_level: 'info' | 'warn', _message: string, _data?: LogContext): void => {
        void _level;
        void _message;
        void _data;
    },
    capture: (_error: Error, _context?: LogContext): void => {
        void _error;
        void _context;
    }
};

export const logger = {
    debug(message: string, context?: LogContext) {
        if (isProd) return;
        console.log(`[debug] ${message}`, context ?? '');
    },
    info(message: string, context?: LogContext) {
        if (isProd) {
            report.breadcrumb('info', message, context);
            return;
        }
        console.log(`[info] ${message}`, context ?? '');
    },
    warn(message: string, context?: LogContext) {
        report.breadcrumb('warn', message, context);
        console.warn(`[warn] ${message}`, context ?? '');
    },
    error(message: string, error?: unknown, context?: LogContext) {
        const err = error instanceof Error ? error : new Error(message);
        report.capture(err, { ...context, message });
        console.error(`[error] ${message}`, error, context ?? '');
    }
};
